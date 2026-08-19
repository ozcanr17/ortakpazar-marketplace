"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { DomainError } from "@/lib/domain/errors";
import { createProduct, toggleFavorite } from "@/lib/marketplace/products";
import { confirmDelivery, createOrder, releaseSellerPayout, shipOrder } from "@/lib/marketplace/orders";
import { openDispute } from "@/lib/marketplace/disputes";
import { getPublicEnv } from "@/lib/env";
import { assertSameOrigin } from "@/lib/security/csrf";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { sanitizeMessage, sanitizeText } from "@/lib/security/text";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getRequestContext } from "@/lib/request";
import { createStoragePath, validateImage } from "@/lib/security/upload";
import { assertProductOwner } from "@/lib/marketplace/products";

export interface MarketplaceActionState { ok: boolean; message: string; id?: string }

const errorState = (error: unknown): MarketplaceActionState => ({ ok: false, message: error instanceof DomainError ? error.message : "İşlem tamamlanamadı" });

export async function createProductAction(formData: FormData): Promise<MarketplaceActionState> {
  try {
    await assertSameOrigin();
    const user = await requireUser("/sat");
    await enforceRateLimit(`product:${user.id}`, 20, 3600, 3600);
    const priceLira = Number(formData.get("price"));
    const files = formData.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
    const product = await createProduct(user, { title: String(formData.get("title") ?? ""), description: String(formData.get("description") ?? ""), categoryId: String(formData.get("categoryId") ?? ""), condition: String(formData.get("condition") ?? "") as "NEW" | "LIKE_NEW" | "GOOD" | "FAIR", priceKurus: Math.round(priceLira * 100), location: String(formData.get("location") ?? "") }, files);
    revalidatePath("/urunler");
    return { ok: true, message: "İlan incelemeye gönderildi", id: product.id };
  } catch (error) { return errorState(error); }
}

export async function toggleFavoriteAction(productId: string): Promise<MarketplaceActionState> {
  try { await assertSameOrigin(); const user = await requireUser("/favoriler"); const active = await toggleFavorite(user, productId); revalidatePath("/favoriler"); return { ok: true, message: active ? "Favorilere eklendi" : "Favorilerden çıkarıldı" }; } catch (error) { return errorState(error); }
}

export async function purchaseAction(productId: string, legalDocumentIds: readonly string[]): Promise<MarketplaceActionState> {
  try {
    await assertSameOrigin();
    const user = await requireUser(`/urun/${productId}`);
    await enforceRateLimit(`checkout:${user.id}`, 10, 900, 1800);
    const idempotencyKey = crypto.randomUUID();
    const orderId = await createOrder(user, productId, legalDocumentIds, idempotencyKey, `${getPublicEnv().NEXT_PUBLIC_APP_URL}/siparisler/${idempotencyKey}`);
    return { ok: true, message: process.env.NODE_ENV === "production" ? "Ödeme sağlayıcısına yönlendiriliyorsunuz" : "Development ortamında mock ödeme tamamlandı", id: orderId };
  } catch (error) { return errorState(error); }
}

export async function shipOrderAction(input: { orderId: string; company: string; trackingNumber: string }): Promise<MarketplaceActionState> {
  try { await assertSameOrigin(); const user = await requireUser("/siparisler"); await shipOrder(user, { ...input, shippedAt: new Date() }); revalidatePath("/siparisler"); return { ok: true, message: "Kargo bilgileri kaydedildi" }; } catch (error) { return errorState(error); }
}

export async function confirmDeliveryAction(orderId: string): Promise<MarketplaceActionState> {
  try { await assertSameOrigin(); const user = await requireUser("/siparisler"); await confirmDelivery(user, orderId); await releaseSellerPayout(null, orderId, `payout:${orderId}`); revalidatePath("/siparisler"); return { ok: true, message: "Teslimat onaylandı" }; } catch (error) { return errorState(error); }
}

export async function openDisputeAction(input: { orderId: string; reason: string; description: string }): Promise<MarketplaceActionState> {
  try { await assertSameOrigin(); const user = await requireUser("/siparisler"); const id = await openDispute(user, { orderId: input.orderId, reason: input.reason as "ITEM_NOT_RECEIVED", description: input.description }); revalidatePath("/siparisler"); return { ok: true, message: "Uyuşmazlık açıldı", id }; } catch (error) { return errorState(error); }
}

export async function sendMessageAction(input: { receiverId: string; orderId?: string; productId?: string; body: string }): Promise<MarketplaceActionState> {
  try {
    await assertSameOrigin();
    const user = await requireUser("/mesajlar");
    const parsed = z.object({ receiverId: z.string().uuid(), orderId: z.string().uuid().optional(), productId: z.string().uuid().optional(), body: z.string().min(1).max(2000) }).refine((value) => value.orderId || value.productId).parse(input);
    if (parsed.receiverId === user.id) throw new DomainError("INVALID_MESSAGE", "Kendinize mesaj gönderemezsiniz");
    const client = createSupabaseAdminClient();
    let allowed = false;
    if (parsed.orderId) {
      const { data } = await client.from("orders").select("buyer_id,seller_id").eq("id", parsed.orderId).single();
      allowed = Boolean(data && [data.buyer_id, data.seller_id].includes(user.id) && [data.buyer_id, data.seller_id].includes(parsed.receiverId));
    } else if (parsed.productId) {
      const { data } = await client.from("products").select("seller_id").eq("id", parsed.productId).single();
      allowed = Boolean(data && (data.seller_id === parsed.receiverId || data.seller_id === user.id));
    }
    if (!allowed) throw new DomainError("MESSAGE_FORBIDDEN", "Bu bağlamda mesaj gönderemezsiniz");
    await enforceRateLimit(`message:${user.id}`, 30, 300, 900);
    const body = sanitizeMessage(parsed.body);
    if (!body) throw new DomainError("INVALID_MESSAGE", "Mesaj boş olamaz");
    const { error } = await client.from("messages").insert({ sender_id: user.id, receiver_id: parsed.receiverId, order_id: parsed.orderId, product_id: parsed.productId, body });
    if (error) throw new Error("Mesaj gönderilemedi");
    revalidatePath("/mesajlar");
    return { ok: true, message: "Mesaj gönderildi" };
  } catch (error) { return errorState(error); }
}

export async function createReviewAction(input: { orderId: string; rating: number; comment?: string }): Promise<MarketplaceActionState> {
  try {
    await assertSameOrigin();
    const user = await requireUser("/siparisler");
    const parsed = z.object({ orderId: z.string().uuid(), rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() }).parse(input);
    const client = createSupabaseAdminClient();
    const { data: order } = await client.from("orders").select("buyer_id,seller_id,order_status").eq("id", parsed.orderId).single();
    if (!order || order.order_status !== "COMPLETED" || ![order.buyer_id, order.seller_id].includes(user.id)) throw new DomainError("REVIEW_FORBIDDEN", "Bu sipariş değerlendirilemez");
    const reviewedUserId = order.buyer_id === user.id ? order.seller_id : order.buyer_id;
    const { error } = await client.from("reviews").insert({ order_id: parsed.orderId, reviewer_id: user.id, reviewed_user_id: reviewedUserId, rating: parsed.rating, comment: parsed.comment ? sanitizeText(parsed.comment, 1000) : null });
    if (error) throw new DomainError("REVIEW_EXISTS", "Bu sipariş için değerlendirme zaten yapılmış");
    return { ok: true, message: "Değerlendirmeniz kaydedildi" };
  } catch (error) { return errorState(error); }
}

export async function updateConsentAction(input: { analytics: boolean; marketing: boolean; anonymousId?: string }): Promise<MarketplaceActionState> {
  try {
    await assertSameOrigin();
    const user = await requireUser("/ayarlar").catch(() => null);
    const context = await getRequestContext();
    const anonymousId = input.anonymousId ? z.string().uuid().parse(input.anonymousId) : crypto.randomUUID();
    const rows = [
      { user_id: user?.id, anonymous_id: user ? null : anonymousId, category: "NECESSARY", granted: true, policy_version: "1.0", ip_address: context.ipAddress, user_agent: context.userAgent },
      { user_id: user?.id, anonymous_id: user ? null : anonymousId, category: "ANALYTICS", granted: input.analytics, policy_version: "1.0", ip_address: context.ipAddress, user_agent: context.userAgent },
      { user_id: user?.id, anonymous_id: user ? null : anonymousId, category: "MARKETING", granted: input.marketing, policy_version: "1.0", ip_address: context.ipAddress, user_agent: context.userAgent },
    ];
    const { error } = await createSupabaseAdminClient().from("consent_history").insert(rows);
    if (error) throw new Error("Tercihler kaydedilemedi");
    return { ok: true, message: "Çerez tercihleriniz kaydedildi", id: anonymousId };
  } catch (error) { return errorState(error); }
}

export async function createDataRequestAction(type: "EXPORT" | "DELETION"): Promise<MarketplaceActionState> {
  try { await assertSameOrigin(); const user = await requireUser("/ayarlar"); const { error } = await createSupabaseAdminClient().from("data_requests").insert({ user_id: user.id, type }); if (error) throw new Error("Talep oluşturulamadı"); return { ok: true, message: type === "EXPORT" ? "Veri dışa aktarma talebiniz alındı" : "Hesap silme talebiniz alındı" }; } catch (error) { return errorState(error); }
}

export async function submitProductVerificationAction(productId: string, file: File): Promise<MarketplaceActionState> {
  try {
    await assertSameOrigin();
    const user = await requireUser("/profil");
    await assertProductOwner(user, productId);
    const client = createSupabaseAdminClient();
    const { data: verification } = await client.from("product_verifications").select("status,challenge_code").eq("product_id", productId).single();
    if (!verification || verification.status !== "REQUESTED" || !verification.challenge_code) throw new DomainError("VERIFICATION_NOT_REQUESTED", "Bu ilan için doğrulama talebi bulunmuyor");
    const validated = await validateImage(file);
    const path = createStoragePath(user.id, validated.extension);
    const { error: uploadError } = await client.storage.from("private-evidence").upload(path, validated.bytes, { contentType: file.type, upsert: false });
    if (uploadError) throw new DomainError("UPLOAD_FAILED", "Kanıt görseli yüklenemedi");
    const { error } = await client.from("product_verifications").update({ status: "SUBMITTED", submitted_at: new Date().toISOString(), evidence_image_path: path }).eq("product_id", productId).eq("status", "REQUESTED");
    if (error) { await client.storage.from("private-evidence").remove([path]); throw new Error("Doğrulama gönderilemedi"); }
    return { ok: true, message: `Kanıt gönderildi. Fotoğrafta ${verification.challenge_code} kodunun açıkça göründüğünden emin olun.` };
  } catch (error) { return errorState(error); }
}

export async function addDisputeEvidenceAction(disputeId: string, file: File, description?: string): Promise<MarketplaceActionState> {
  try {
    await assertSameOrigin();
    const user = await requireUser("/siparisler");
    const client = createSupabaseAdminClient();
    const { data: dispute } = await client.from("disputes").select("order_id,status,order:orders(buyer_id,seller_id)").eq("id", disputeId).single();
    const order = dispute?.order?.[0];
    if (!dispute || !order || ![order.buyer_id, order.seller_id].includes(user.id) || ["CLOSED", "RESOLVED_BUYER", "RESOLVED_SELLER"].includes(dispute.status)) throw new DomainError("EVIDENCE_FORBIDDEN", "Bu uyuşmazlığa kanıt ekleyemezsiniz");
    const validated = await validateImage(file); const path = createStoragePath(user.id, validated.extension);
    const { error: uploadError } = await client.storage.from("private-evidence").upload(path, validated.bytes, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error("Kanıt yüklenemedi");
    const { error } = await client.from("dispute_evidence").insert({ dispute_id: disputeId, submitted_by: user.id, storage_path: path, mime_type: file.type, description: description ? sanitizeText(description, 500) : null });
    if (error) { await client.storage.from("private-evidence").remove([path]); throw new Error("Kanıt kaydedilemedi"); }
    return { ok: true, message: "Kanıt uyuşmazlığa eklendi" };
  } catch (error) { return errorState(error); }
}
