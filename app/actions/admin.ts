"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireRecentAuthentication } from "@/lib/auth";
import { resolveDispute } from "@/lib/marketplace/disputes";
import { moderateProduct, requestProductVerification, reviewProductVerification, setUserStatus, updatePlatformSettings } from "@/lib/marketplace/admin";
import { assertSameOrigin } from "@/lib/security/csrf";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import type { MarketplaceActionState } from "./marketplace";
import { publishLegalDocument, updateComplianceItem } from "@/lib/marketplace/legal";
import { appendAuditLog } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const state = (error: unknown): MarketplaceActionState => ({ ok: false, message: error instanceof Error ? error.message : "İşlem tamamlanamadı" });

export async function userStatusAction(userId: string, status: "ACTIVE" | "SUSPENDED" | "BANNED"): Promise<MarketplaceActionState> {
  try { await assertSameOrigin(); const admin = await requireRecentAuthentication(); await enforceRateLimit(`admin:${admin.id}`, 60, 300, 900); await setUserStatus(admin, userId, status); revalidatePath("/admin/users"); return { ok: true, message: "Kullanıcı durumu güncellendi" }; } catch (error) { return state(error); }
}

export async function productModerationAction(input: { productId: string; action: "APPROVE" | "REJECT" | "REMOVE"; note?: string }): Promise<MarketplaceActionState> {
  try { await assertSameOrigin(); const admin = await requireAdmin(); await moderateProduct(admin, input); revalidatePath("/admin/products"); return { ok: true, message: "İlan güncellendi" }; } catch (error) { return state(error); }
}

export async function requestVerificationAction(productId: string): Promise<MarketplaceActionState> {
  try { await assertSameOrigin(); const admin = await requireAdmin(); const code = await requestProductVerification(admin, productId); revalidatePath("/admin/products"); return { ok: true, message: `Doğrulama kodu: ${code}` }; } catch (error) { return state(error); }
}

export async function reviewVerificationAction(input: { productId: string; verified: boolean; note: string }): Promise<MarketplaceActionState> {
  try { await assertSameOrigin(); const admin = await requireAdmin(); await reviewProductVerification(admin, input); revalidatePath("/admin/products"); return { ok: true, message: "Doğrulama sonucu kaydedildi" }; } catch (error) { return state(error); }
}

export async function resolveDisputeAction(input: { disputeId: string; resolution: "REFUND" | "PARTIAL_REFUND" | "RELEASE"; amountKurus?: number; note: string }): Promise<MarketplaceActionState> {
  try { await assertSameOrigin(); const admin = await requireRecentAuthentication(); await resolveDispute(admin, input); revalidatePath("/admin/disputes"); return { ok: true, message: "Uyuşmazlık sonuçlandırıldı" }; } catch (error) { return state(error); }
}

export async function updateSettingsAction(input: Parameters<typeof updatePlatformSettings>[1]): Promise<MarketplaceActionState> {
  try { await assertSameOrigin(); const admin = await requireRecentAuthentication(); await updatePlatformSettings(admin, input); revalidatePath("/admin/settings"); return { ok: true, message: "Ayarlar güncellendi" }; } catch (error) { return state(error); }
}

export async function publishLegalDocumentAction(input: Parameters<typeof publishLegalDocument>[1]): Promise<MarketplaceActionState> {
  try { await assertSameOrigin(); const admin = await requireRecentAuthentication(); const id = await publishLegalDocument(admin, input); revalidatePath("/admin/legal"); return { ok: true, message: "Hukuki metin yeni sürüm olarak yayınlandı", id }; } catch (error) { return state(error); }
}

export async function updateComplianceAction(input: Parameters<typeof updateComplianceItem>[1]): Promise<MarketplaceActionState> {
  try { await assertSameOrigin(); const admin = await requireAdmin(); await updateComplianceItem(admin, input); revalidatePath("/admin/compliance"); return { ok: true, message: "Uyumluluk maddesi güncellendi" }; } catch (error) { return state(error); }
}

export async function markDeliveredAction(orderId: string): Promise<MarketplaceActionState> {
  try { await assertSameOrigin(); const admin = await requireAdmin(); const { error } = await createSupabaseAdminClient().rpc("admin_mark_delivered", { p_order_id: orderId, p_admin_id: admin.id, p_delivered_at: new Date().toISOString() }); if (error) throw new Error("Teslimat güncellenemedi"); await appendAuditLog({ actorId: admin.id, action: "ORDER_MARKED_DELIVERED", targetType: "ORDER", targetId: orderId, newValue: { shippingStatus: "DELIVERED" } }); revalidatePath("/admin/orders"); return { ok: true, message: "Teslimat kaydedildi" }; } catch (error) { return state(error); }
}

export async function requestDisputeEvidenceAction(disputeId: string, party: "BUYER" | "SELLER"): Promise<MarketplaceActionState> {
  try { await assertSameOrigin(); const admin = await requireAdmin(); const status = party === "BUYER" ? "WAITING_BUYER" : "WAITING_SELLER"; const { error } = await createSupabaseAdminClient().from("disputes").update({ status, assigned_admin: admin.id }).eq("id", disputeId).in("status", ["OPEN", "UNDER_REVIEW", "WAITING_BUYER", "WAITING_SELLER"]); if (error) throw new Error("Kanıt talebi gönderilemedi"); await appendAuditLog({ actorId: admin.id, action: `DISPUTE_EVIDENCE_REQUESTED_${party}`, targetType: "DISPUTE", targetId: disputeId, newValue: { status } }); revalidatePath("/admin/disputes"); return { ok: true, message: "Kanıt talebi kaydedildi" }; } catch (error) { return state(error); }
}
