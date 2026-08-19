"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { DomainError } from "@/lib/domain/errors";
import { assertSameOrigin } from "@/lib/security/csrf";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { sanitizeMessage, sanitizeText } from "@/lib/security/text";
import { getRequestContext } from "@/lib/request";
import { createStoragePath, validateImage } from "@/lib/security/upload";
import { assertProductOwner } from "@/lib/marketplace/products";
import { database, ensureDatabase, uploads } from "@/lib/database";
import { createPersistentProduct, togglePersistentFavorite } from "@/lib/persistent-marketplace";
import { confirmPersistentDelivery, createPersistentOrder, openPersistentDispute, shipPersistentOrder } from "@/lib/persistent-orders";

export interface MarketplaceActionState { ok: boolean; message: string; id?: string }

const errorState = (error: unknown): MarketplaceActionState => ({ ok: false, message: error instanceof DomainError ? error.message : "İşlem tamamlanamadı" });

export async function createProductAction(formData: FormData): Promise<MarketplaceActionState> {
  try {
    await assertSameOrigin();
    const user = await requireUser("/sat");
    await enforceRateLimit(`product:${user.id}`, 20, 3600, 3600);
    const parsed = z.object({ title: z.string().min(5).max(160), description: z.string().min(20).max(10000), categoryId: z.string().uuid(), condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR"]), priceLira: z.number().positive().max(1_000_000), location: z.string().min(2).max(120) }).parse({ title: String(formData.get("title") ?? ""), description: String(formData.get("description") ?? ""), categoryId: String(formData.get("categoryId") ?? ""), condition: String(formData.get("condition") ?? ""), priceLira: Number(formData.get("price")), location: String(formData.get("location") ?? "") });
    const files = formData.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
    const productId = await createPersistentProduct(user, { title: sanitizeText(parsed.title, 160), description: sanitizeText(parsed.description, 10000), categoryId: parsed.categoryId, condition: parsed.condition, priceKurus: Math.round(parsed.priceLira * 100), location: sanitizeText(parsed.location, 120) }, files);
    revalidatePath("/urunler");
    return { ok: true, message: "İlan incelemeye gönderildi", id: productId };
  } catch (error) { return errorState(error); }
}

export async function toggleFavoriteAction(productId: string): Promise<MarketplaceActionState> {
  try { await assertSameOrigin(); const user = await requireUser("/favoriler"); const active = await togglePersistentFavorite(user.id, z.string().uuid().parse(productId)); revalidatePath("/favoriler"); return { ok: true, message: active ? "Favorilere eklendi" : "Favorilerden çıkarıldı" }; } catch (error) { return errorState(error); }
}

export async function purchaseAction(productId: string, legalDocumentIds: readonly string[]): Promise<MarketplaceActionState> {
  try {
    await assertSameOrigin();
    const user = await requireUser(`/urun/${productId}`);
    await enforceRateLimit(`checkout:${user.id}`, 10, 900, 1800);
    const orderId = await createPersistentOrder(user, z.string().uuid().parse(productId), legalDocumentIds);
    return { ok: true, message: "Demo ödeme korumalı akışta simüle edildi. Gerçek para hareketi yapılmadı", id: orderId };
  } catch (error) { return errorState(error); }
}

export async function shipOrderAction(input: { orderId: string; company: string; trackingNumber: string }): Promise<MarketplaceActionState> {
  try { await assertSameOrigin(); const user = await requireUser("/siparisler"); const parsed = z.object({ orderId: z.string().uuid(), company: z.string().min(2).max(100), trackingNumber: z.string().min(3).max(120) }).parse(input); await shipPersistentOrder(user.id, parsed.orderId, sanitizeText(parsed.company, 100), sanitizeText(parsed.trackingNumber, 120)); revalidatePath("/siparisler"); return { ok: true, message: "Kargo bilgileri kaydedildi" }; } catch (error) { return errorState(error); }
}

export async function confirmDeliveryAction(orderId: string): Promise<MarketplaceActionState> {
  try { await assertSameOrigin(); const user = await requireUser("/siparisler"); await confirmPersistentDelivery(user.id, z.string().uuid().parse(orderId)); revalidatePath("/siparisler"); return { ok: true, message: "Teslimat onaylandı; demo ödeme satıcıya bırakıldı" }; } catch (error) { return errorState(error); }
}

export async function openDisputeAction(input: { orderId: string; reason: string; description: string }): Promise<MarketplaceActionState> {
  try { await assertSameOrigin(); const user = await requireUser("/siparisler"); const parsed = z.object({ orderId: z.string().uuid(), reason: z.enum(["ITEM_NOT_RECEIVED","ITEM_NOT_AS_DESCRIBED","DAMAGED","COUNTERFEIT","PAYMENT","RETURN","OTHER"]), description: z.string().min(20).max(3000) }).parse(input); const id = await openPersistentDispute(user.id, parsed.orderId, parsed.reason, sanitizeText(parsed.description, 3000)); revalidatePath("/siparisler"); return { ok: true, message: "Uyuşmazlık açıldı; satıcı ödemesi bloke edildi", id }; } catch (error) { return errorState(error); }
}

export async function sendMessageAction(input: { receiverId: string; orderId?: string; productId?: string; body: string }): Promise<MarketplaceActionState> {
  try {
    await assertSameOrigin();
    const user = await requireUser("/mesajlar");
    const parsed = z.object({ receiverId: z.string().uuid(), orderId: z.string().uuid().optional(), productId: z.string().uuid().optional(), body: z.string().min(1).max(2000) }).parse(input);
    if (parsed.receiverId === user.id) throw new DomainError("INVALID_MESSAGE", "Kendinize mesaj gönderemezsiniz");
    let allowed = false;
    if (parsed.orderId) {
      const data = await database().prepare("SELECT buyer_id,seller_id FROM orders WHERE id = ?").bind(parsed.orderId).first<{ buyer_id: string; seller_id: string }>();
      allowed = Boolean(data && [data.buyer_id, data.seller_id].includes(user.id) && [data.buyer_id, data.seller_id].includes(parsed.receiverId));
    } else if (parsed.productId) {
      const data = await database().prepare("SELECT seller_id FROM products WHERE id = ?").bind(parsed.productId).first<{ seller_id: string }>();
      if (data?.seller_id === parsed.receiverId) allowed = true;
      else if (data?.seller_id === user.id) {
        const relation = await database().prepare("SELECT 1 AS found FROM messages WHERE product_id = ? AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)) UNION SELECT 1 AS found FROM orders WHERE product_id = ? AND seller_id = ? AND buyer_id = ? LIMIT 1")
          .bind(parsed.productId, user.id, parsed.receiverId, parsed.receiverId, user.id, parsed.productId, user.id, parsed.receiverId).first();
        allowed = Boolean(relation);
      }
    } else {
      const receiver = await database().prepare("SELECT role FROM users WHERE id = ? AND status = 'ACTIVE'").bind(parsed.receiverId).first<{ role: string }>();
      allowed = Boolean(receiver && (user.role !== "USER" || receiver.role !== "USER"));
    }
    if (!allowed) throw new DomainError("MESSAGE_FORBIDDEN", "Bu bağlamda mesaj gönderemezsiniz");
    await enforceRateLimit(`message:${user.id}`, 30, 300, 900);
    const body = sanitizeMessage(parsed.body);
    if (!body) throw new DomainError("INVALID_MESSAGE", "Mesaj boş olamaz");
    await database().prepare("INSERT INTO messages (id,sender_id,receiver_id,order_id,product_id,body,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), user.id, parsed.receiverId, parsed.orderId ?? null, parsed.productId ?? null, body, new Date().toISOString()).run();
    revalidatePath("/mesajlar");
    return { ok: true, message: "Mesaj gönderildi" };
  } catch (error) { return errorState(error); }
}

export async function createReviewAction(input: { orderId: string; rating: number; comment?: string }): Promise<MarketplaceActionState> {
  try {
    await assertSameOrigin();
    const user = await requireUser("/siparisler");
    const parsed = z.object({ orderId: z.string().uuid(), rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() }).parse(input);
    const order = await database().prepare("SELECT buyer_id,seller_id,order_status FROM orders WHERE id = ?").bind(parsed.orderId).first<{ buyer_id: string; seller_id: string; order_status: string }>();
    if (!order || order.order_status !== "COMPLETED" || ![order.buyer_id, order.seller_id].includes(user.id)) throw new DomainError("REVIEW_FORBIDDEN", "Bu sipariş değerlendirilemez");
    const reviewedUserId = order.buyer_id === user.id ? order.seller_id : order.buyer_id;
    try { await database().prepare("INSERT INTO reviews (id,order_id,reviewer_id,reviewed_user_id,rating,comment,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), parsed.orderId, user.id, reviewedUserId, parsed.rating, parsed.comment ? sanitizeText(parsed.comment, 1000) : null, new Date().toISOString()).run(); } catch { throw new DomainError("REVIEW_EXISTS", "Bu sipariş için değerlendirme zaten yapılmış"); }
    return { ok: true, message: "Değerlendirmeniz kaydedildi" };
  } catch (error) { return errorState(error); }
}

export async function updateConsentAction(input: { analytics: boolean; marketing: boolean; anonymousId?: string }): Promise<MarketplaceActionState> {
  try {
    await assertSameOrigin();
    await ensureDatabase();
    const user = await getCurrentUser();
    const context = await getRequestContext();
    const anonymousId = input.anonymousId ? z.string().uuid().parse(input.anonymousId) : crypto.randomUUID();
    await database().prepare("INSERT INTO cookie_consents (id,user_id,anonymous_id,analytics,marketing,policy_version,ip_address,user_agent,created_at) VALUES (?,?,?,?,?,'1.0',?,?,?)")
      .bind(crypto.randomUUID(), user?.id ?? null, user ? null : anonymousId, input.analytics ? 1 : 0, input.marketing ? 1 : 0, context.ipAddress, context.userAgent, new Date().toISOString()).run();
    return { ok: true, message: "Çerez tercihleriniz kaydedildi", id: anonymousId };
  } catch (error) { return errorState(error); }
}

export async function createDataRequestAction(type: "EXPORT" | "DELETION"): Promise<MarketplaceActionState> {
  try { await assertSameOrigin(); const user = await requireUser("/ayarlar"); await database().prepare("INSERT INTO data_requests (id,user_id,type,status,created_at) VALUES (?,?,?,'OPEN',?)").bind(crypto.randomUUID(), user.id, type, new Date().toISOString()).run(); return { ok: true, message: type === "EXPORT" ? "Veri dışa aktarma talebiniz alındı" : "Hesap silme talebiniz alındı" }; } catch (error) { return errorState(error); }
}

export async function submitProductVerificationAction(productId: string, file: File): Promise<MarketplaceActionState> {
  try {
    await assertSameOrigin();
    const user = await requireUser("/profil");
    await assertProductOwner(user, productId);
    const verification = await database().prepare("SELECT status,challenge_code FROM product_verifications WHERE product_id = ?").bind(productId).first<{ status: string; challenge_code: string | null }>();
    if (!verification || verification.status !== "REQUESTED" || !verification.challenge_code) throw new DomainError("VERIFICATION_NOT_REQUESTED", "Bu ilan için doğrulama talebi bulunmuyor");
    const validated = await validateImage(file);
    const path = createStoragePath(user.id, validated.extension);
    await uploads().put(path, validated.bytes, { httpMetadata: { contentType: file.type } });
    const result = await database().prepare("UPDATE product_verifications SET status = 'SUBMITTED', submitted_at = ?, evidence_image_key = ? WHERE product_id = ? AND status = 'REQUESTED'").bind(new Date().toISOString(), path, productId).run();
    if (!result.meta.changes) { await uploads().delete(path); throw new Error("Doğrulama gönderilemedi"); }
    return { ok: true, message: `Kanıt gönderildi. Fotoğrafta ${verification.challenge_code} kodunun açıkça göründüğünden emin olun.` };
  } catch (error) { return errorState(error); }
}

export async function addDisputeEvidenceAction(disputeId: string, file: File, description?: string): Promise<MarketplaceActionState> {
  try {
    await assertSameOrigin();
    const user = await requireUser("/siparisler");
    const dispute = await database().prepare("SELECT d.status,o.buyer_id,o.seller_id FROM disputes d JOIN orders o ON o.id = d.order_id WHERE d.id = ?").bind(disputeId).first<{ status: string; buyer_id: string; seller_id: string }>();
    if (!dispute || ![dispute.buyer_id, dispute.seller_id].includes(user.id) || ["CLOSED", "RESOLVED_BUYER", "RESOLVED_SELLER"].includes(dispute.status)) throw new DomainError("EVIDENCE_FORBIDDEN", "Bu uyuşmazlığa kanıt ekleyemezsiniz");
    const validated = await validateImage(file); const path = createStoragePath(user.id, validated.extension);
    await uploads().put(path, validated.bytes, { httpMetadata: { contentType: file.type } });
    try { await database().prepare("INSERT INTO dispute_evidence (id,dispute_id,submitted_by,storage_key,mime_type,description,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), disputeId, user.id, path, file.type, description ? sanitizeText(description, 500) : null, new Date().toISOString()).run(); } catch (error) { await uploads().delete(path); throw error; }
    return { ok: true, message: "Kanıt uyuşmazlığa eklendi" };
  } catch (error) { return errorState(error); }
}
