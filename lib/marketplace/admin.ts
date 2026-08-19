import { z } from "zod";
import type { AppUser } from "@/lib/auth";
import { AuthorizationError, DomainError } from "@/lib/domain/errors";
import { createVerificationChallenge } from "@/lib/providers/image-verification";
import { appendAuditLog } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sanitizeText } from "@/lib/security/text";

const assertAdmin = (user: AppUser, superAdminOnly = false) => {
  const allowed = superAdminOnly ? user.role === "SUPER_ADMIN" : ["MODERATOR", "ADMIN", "SUPER_ADMIN"].includes(user.role);
  if (!allowed) throw new AuthorizationError();
};

export async function getDashboardMetrics(user: AppUser) {
  assertAdmin(user);
  const client = createSupabaseAdminClient();
  const [users, activeProducts, pendingProducts, orders, disputes, verifications, refunds, totals, payouts] = await Promise.all([
    client.from("users").select("id", { count: "exact", head: true }),
    client.from("products").select("id", { count: "exact", head: true }).eq("status", "ACTIVE"),
    client.from("products").select("id", { count: "exact", head: true }).eq("status", "PENDING_REVIEW"),
    client.from("orders").select("id", { count: "exact", head: true }),
    client.from("disputes").select("id", { count: "exact", head: true }).in("status", ["OPEN", "UNDER_REVIEW", "WAITING_BUYER", "WAITING_SELLER"]),
    client.from("product_verifications").select("id", { count: "exact", head: true }).in("status", ["REQUESTED", "SUBMITTED"]),
    client.from("orders").select("id", { count: "exact", head: true }).eq("order_status", "REFUNDED"),
    client.from("orders").select("product_price_kurus,platform_fee_kurus,seller_net_amount_kurus"),
    client.from("payouts").select("amount_kurus,status"),
  ]);
  const volumeKurus = totals.data?.reduce((sum, item) => sum + item.product_price_kurus, 0) ?? 0;
  const revenueKurus = totals.data?.reduce((sum, item) => sum + item.platform_fee_kurus, 0) ?? 0;
  const sellerPayableKurus = totals.data?.reduce((sum, item) => sum + item.seller_net_amount_kurus, 0) ?? 0;
  const paidSellerKurus = payouts.data?.filter((item) => item.status === "PAID").reduce((sum, item) => sum + item.amount_kurus, 0) ?? 0;
  const pendingPayoutKurus = payouts.data?.filter((item) => ["PENDING", "PROCESSING"].includes(item.status)).reduce((sum, item) => sum + item.amount_kurus, 0) ?? 0;
  return { totalUsers: users.count ?? 0, activeProducts: activeProducts.count ?? 0, pendingProducts: pendingProducts.count ?? 0, totalOrders: orders.count ?? 0, openDisputes: disputes.count ?? 0, pendingVerifications: verifications.count ?? 0, refunds: refunds.count ?? 0, volumeKurus, revenueKurus, sellerPayableKurus, paidSellerKurus, pendingPayoutKurus };
}

export async function setUserStatus(admin: AppUser, userId: string, status: "ACTIVE" | "SUSPENDED" | "BANNED"): Promise<void> {
  assertAdmin(admin, true);
  const id = z.string().uuid().parse(userId);
  if (id === admin.id) throw new DomainError("SELF_STATUS_CHANGE", "Kendi hesabınızın durumunu değiştiremezsiniz");
  const client = createSupabaseAdminClient();
  const { data: current } = await client.from("users").select("status,role,auth_user_id").eq("id", id).single();
  if (!current || current.role === "SUPER_ADMIN") throw new AuthorizationError();
  const invalidBefore = status === "ACTIVE" ? null : new Date().toISOString();
  const { error } = await client.from("users").update({ status, session_invalid_before: invalidBefore }).eq("id", id);
  if (error) throw new Error("Kullanıcı durumu güncellenemedi");
  if (status !== "ACTIVE") await client.auth.admin.signOut(current.auth_user_id, "global");
  await appendAuditLog({ actorId: admin.id, action: `USER_${status}`, targetType: "USER", targetId: id, oldValue: { status: current.status }, newValue: { status } });
}

export async function moderateProduct(admin: AppUser, input: { productId: string; action: "APPROVE" | "REJECT" | "REMOVE"; note?: string }): Promise<void> {
  assertAdmin(admin);
  const parsed = z.object({ productId: z.string().uuid(), action: z.enum(["APPROVE", "REJECT", "REMOVE"]), note: z.string().max(1000).optional() }).parse(input);
  const client = createSupabaseAdminClient();
  const { data: product } = await client.from("products").select("status,title").eq("id", parsed.productId).single();
  if (!product) throw new DomainError("PRODUCT_NOT_FOUND", "İlan bulunamadı");
  const status = parsed.action === "APPROVE" ? "ACTIVE" : parsed.action === "REJECT" ? "REJECTED" : "REMOVED";
  const { error } = await client.from("products").update({ status, rejection_reason: parsed.note ? sanitizeText(parsed.note, 1000) : null, published_at: status === "ACTIVE" ? new Date().toISOString() : null }).eq("id", parsed.productId);
  if (error) throw new Error("İlan güncellenemedi");
  await appendAuditLog({ actorId: admin.id, action: `PRODUCT_${parsed.action}`, targetType: "PRODUCT", targetId: parsed.productId, oldValue: { status: product.status }, newValue: { status, note: parsed.note ?? null } });
}

export async function requestProductVerification(admin: AppUser, productId: string): Promise<string> {
  assertAdmin(admin);
  const id = z.string().uuid().parse(productId);
  const challengeCode = createVerificationChallenge();
  const { error } = await createSupabaseAdminClient().from("product_verifications").upsert({ product_id: id, challenge_code: challengeCode, requested_at: new Date().toISOString(), status: "REQUESTED", reviewed_by: null, review_note: null }, { onConflict: "product_id" });
  if (error) throw new Error("Doğrulama talebi oluşturulamadı");
  await appendAuditLog({ actorId: admin.id, action: "PRODUCT_VERIFICATION_REQUESTED", targetType: "PRODUCT", targetId: id, newValue: { challengeCode } });
  return challengeCode;
}

export async function reviewProductVerification(admin: AppUser, input: { productId: string; verified: boolean; note: string }): Promise<void> {
  assertAdmin(admin);
  const parsed = z.object({ productId: z.string().uuid(), verified: z.boolean(), note: z.string().min(3).max(1000) }).parse(input);
  const { error } = await createSupabaseAdminClient().from("product_verifications").update({ status: parsed.verified ? "VERIFIED" : "REJECTED", reviewed_by: admin.id, review_note: sanitizeText(parsed.note, 1000) }).eq("product_id", parsed.productId).eq("status", "SUBMITTED");
  if (error) throw new Error("Doğrulama sonucu kaydedilemedi");
  await appendAuditLog({ actorId: admin.id, action: parsed.verified ? "PRODUCT_VERIFIED" : "PRODUCT_VERIFICATION_REJECTED", targetType: "PRODUCT", targetId: parsed.productId, newValue: { note: parsed.note } });
}

export async function updatePlatformSettings(admin: AppUser, input: { commissionType: "PERCENTAGE" | "FIXED" | "HYBRID"; percentageBasisPoints: number; fixedFeeKurus: number; minimumFeeKurus: number; maximumFeeKurus: number | null; disputePeriodHours: number; sellerShippingDeadlineHours: number; buyerConfirmationPeriodHours: number; prohibitedCategories: string[]; maintenanceMode: boolean }): Promise<void> {
  assertAdmin(admin, true);
  const parsed = z.object({ commissionType: z.enum(["PERCENTAGE", "FIXED", "HYBRID"]), percentageBasisPoints: z.number().int().min(0).max(10000), fixedFeeKurus: z.number().int().min(0), minimumFeeKurus: z.number().int().min(0), maximumFeeKurus: z.number().int().min(0).nullable(), disputePeriodHours: z.number().int().min(1).max(720), sellerShippingDeadlineHours: z.number().int().min(1).max(720), buyerConfirmationPeriodHours: z.number().int().min(1).max(720), prohibitedCategories: z.array(z.string().uuid()).max(100), maintenanceMode: z.boolean() }).parse(input);
  const client = createSupabaseAdminClient();
  const { data: oldValue } = await client.from("platform_settings").select("*").eq("id", 1).single();
  const { error } = await client.from("platform_settings").update({ commission_type: parsed.commissionType, percentage_basis_points: parsed.percentageBasisPoints, fixed_fee_kurus: parsed.fixedFeeKurus, minimum_fee_kurus: parsed.minimumFeeKurus, maximum_fee_kurus: parsed.maximumFeeKurus, dispute_period_hours: parsed.disputePeriodHours, seller_shipping_deadline_hours: parsed.sellerShippingDeadlineHours, buyer_confirmation_period_hours: parsed.buyerConfirmationPeriodHours, prohibited_categories: parsed.prohibitedCategories, maintenance_mode: parsed.maintenanceMode, updated_by: admin.id, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) throw new Error("Ayarlar güncellenemedi");
  await appendAuditLog({ actorId: admin.id, action: "PLATFORM_SETTINGS_UPDATED", targetType: "PLATFORM_SETTINGS", targetId: "1", oldValue: oldValue ?? undefined, newValue: parsed });
}
