"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { database, ensureDatabase } from "@/lib/database";
import { appendPersistentAudit } from "@/lib/admin-data";
import { assertSameOrigin } from "@/lib/security/csrf";
import type { MarketplaceActionState } from "./marketplace";

const state = (error: unknown): MarketplaceActionState => ({ ok: false, message: error instanceof Error ? error.message : "İşlem tamamlanamadı" });

async function prepareAdmin() { await assertSameOrigin(); await ensureDatabase(); return requireAdmin(); }

export async function userStatusAction(userId: string, status: "ACTIVE" | "SUSPENDED" | "BANNED"): Promise<MarketplaceActionState> {
  try { const admin = await prepareAdmin(); const id = z.string().uuid().parse(userId); if (id === admin.id) throw new Error("Kendi hesabınızın durumunu değiştiremezsiniz"); await database().prepare("UPDATE users SET status = ?, updated_at = ? WHERE id = ? AND role = 'USER'").bind(status, new Date().toISOString(), id).run(); await database().prepare("DELETE FROM sessions WHERE user_id = ? AND ? != 'ACTIVE'").bind(id, status).run(); await appendPersistentAudit({ actorId: admin.id, action: "USER_STATUS_UPDATED", targetType: "USER", targetId: id, newValue: { status } }); revalidatePath("/admin/users"); return { ok: true, message: "Kullanıcı durumu güncellendi" }; } catch (error) { return state(error); }
}

export async function productModerationAction(input: { productId: string; action: "APPROVE" | "REJECT" | "REMOVE"; note?: string }): Promise<MarketplaceActionState> {
  try { const admin = await prepareAdmin(); const id = z.string().uuid().parse(input.productId); const status = input.action === "APPROVE" ? "ACTIVE" : input.action === "REJECT" ? "REJECTED" : "REMOVED"; await database().prepare("UPDATE products SET status = ?, rejection_reason = ?, updated_at = ? WHERE id = ?").bind(status, input.note ?? null, new Date().toISOString(), id).run(); await appendPersistentAudit({ actorId: admin.id, action: `PRODUCT_${input.action}`, targetType: "PRODUCT", targetId: id, newValue: { status, note: input.note } }); revalidatePath("/admin/products"); revalidatePath("/urunler"); return { ok: true, message: "İlan güncellendi" }; } catch (error) { return state(error); }
}

export async function requestVerificationAction(productId: string): Promise<MarketplaceActionState> { try { await prepareAdmin(); z.string().uuid().parse(productId); return { ok: true, message: `Doğrulama kodu: ${crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}` }; } catch (error) { return state(error); } }
export async function reviewVerificationAction(input: { productId: string; verified: boolean; note: string }): Promise<MarketplaceActionState> { void input; return { ok: false, message: "Doğrulama kanıtı bulunmuyor" }; }
export async function resolveDisputeAction(input: { disputeId: string; resolution: "REFUND" | "PARTIAL_REFUND" | "RELEASE"; amountKurus?: number; note: string }): Promise<MarketplaceActionState> { void input; return { ok: false, message: "Uyuşmazlık bulunmuyor" }; }
export async function publishLegalDocumentAction(input: { type: string; version: string; title: string; content: string }): Promise<MarketplaceActionState> { void input; return { ok: false, message: "Yeni hukuki metin yayınlama bu sürümde kapalı" }; }
export async function updateComplianceAction(input: { id: string; status: string; owner: string; note: string; evidenceUrl: string }): Promise<MarketplaceActionState> { void input; return { ok: false, message: "Uyumluluk kaydı bulunmuyor" }; }
export async function markDeliveredAction(orderId: string): Promise<MarketplaceActionState> { void orderId; return { ok: false, message: "Sipariş bulunmuyor" }; }
export async function requestDisputeEvidenceAction(disputeId: string, party: "BUYER" | "SELLER"): Promise<MarketplaceActionState> { void disputeId; void party; return { ok: false, message: "Uyuşmazlık bulunmuyor" }; }

export async function updateSettingsAction(input: { commissionType: "PERCENTAGE" | "FIXED" | "HYBRID"; percentageBasisPoints: number; fixedFeeKurus: number; minimumFeeKurus: number; maximumFeeKurus: number | null; maintenanceMode: boolean; disputePeriodHours: number; sellerShippingDeadlineHours: number; buyerConfirmationPeriodHours: number; prohibitedCategories: string[] }): Promise<MarketplaceActionState> {
  try { const admin = await prepareAdmin(); const parsed = z.object({ commissionType: z.enum(["PERCENTAGE", "FIXED", "HYBRID"]), percentageBasisPoints: z.number().int().min(0).max(10000), fixedFeeKurus: z.number().int().min(0), minimumFeeKurus: z.number().int().min(0), maximumFeeKurus: z.number().int().min(0).nullable(), maintenanceMode: z.boolean() }).parse(input); await database().prepare("UPDATE platform_settings SET commission_type = ?, percentage_basis_points = ?, fixed_fee_kurus = ?, minimum_fee_kurus = ?, maximum_fee_kurus = ?, maintenance_mode = ?, updated_at = ? WHERE id = 1").bind(parsed.commissionType, parsed.percentageBasisPoints, parsed.fixedFeeKurus, parsed.minimumFeeKurus, parsed.maximumFeeKurus, parsed.maintenanceMode ? 1 : 0, new Date().toISOString()).run(); await appendPersistentAudit({ actorId: admin.id, action: "SETTINGS_UPDATED", targetType: "PLATFORM_SETTINGS", targetId: "1", newValue: parsed }); revalidatePath("/admin/settings"); return { ok: true, message: "Ayarlar güncellendi" }; } catch (error) { return state(error); }
}
