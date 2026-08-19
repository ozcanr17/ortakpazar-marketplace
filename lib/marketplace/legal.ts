import { z } from "zod";
import type { AppUser } from "@/lib/auth";
import { AuthorizationError, DomainError } from "@/lib/domain/errors";
import { appendAuditLog } from "@/lib/audit";
import { sanitizeText } from "@/lib/security/text";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const types = ["USER_AGREEMENT", "MARKETPLACE_AGREEMENT", "SELLER_AGREEMENT", "PRIVACY_NOTICE", "KVKK_NOTICE", "COOKIE_POLICY", "DISTANCE_SALES_INFORMATION", "DISTANCE_SALES_AGREEMENT_TEMPLATE", "RETURN_REFUND_POLICY", "PROHIBITED_PRODUCTS_POLICY", "DISPUTE_POLICY", "COMMISSION_POLICY"] as const;

export async function publishLegalDocument(admin: AppUser, input: { type: typeof types[number]; version: string; title: string; content: string }): Promise<string> {
  if (!["ADMIN", "SUPER_ADMIN"].includes(admin.role)) throw new AuthorizationError();
  const parsed = z.object({ type: z.enum(types), version: z.string().min(1).max(32), title: z.string().min(5).max(200), content: z.string().min(100).max(200000) }).parse(input);
  const { data, error } = await createSupabaseAdminClient().rpc("publish_legal_document", { p_actor_id: admin.id, p_type: parsed.type, p_version: sanitizeText(parsed.version, 32), p_title: sanitizeText(parsed.title, 200), p_content: parsed.content.trim() });
  if (error || typeof data !== "string") throw new DomainError("LEGAL_PUBLISH_FAILED", "Hukuki metin yayınlanamadı");
  await appendAuditLog({ actorId: admin.id, action: "LEGAL_DOCUMENT_PUBLISHED", targetType: "LEGAL_DOCUMENT", targetId: data, newValue: { type: parsed.type, version: parsed.version, title: parsed.title, requiresLegalReview: true } });
  return data;
}

export async function updateComplianceItem(admin: AppUser, input: { id: string; status: string; owner?: string; note?: string; evidenceUrl?: string }): Promise<void> {
  if (!["ADMIN", "SUPER_ADMIN"].includes(admin.role)) throw new AuthorizationError();
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(["NOT_REVIEWED", "IN_PROGRESS", "READY", "NEEDS_COUNSEL", "BLOCKED"]), owner: z.string().max(120).optional(), note: z.string().max(5000).optional(), evidenceUrl: z.string().url().optional().or(z.literal("")) }).parse(input);
  const client = createSupabaseAdminClient();
  const { data: oldValue } = await client.from("compliance_items").select("status,owner,note,evidence_url").eq("id", parsed.id).single();
  const { error } = await client.from("compliance_items").update({ status: parsed.status, owner: parsed.owner ? sanitizeText(parsed.owner, 120) : null, note: parsed.note ? sanitizeText(parsed.note, 5000) : null, evidence_url: parsed.evidenceUrl || null, reviewed_at: new Date().toISOString(), updated_by: admin.id }).eq("id", parsed.id);
  if (error) throw new Error("Uyumluluk maddesi güncellenemedi");
  await appendAuditLog({ actorId: admin.id, action: "COMPLIANCE_ITEM_UPDATED", targetType: "COMPLIANCE_ITEM", targetId: parsed.id, oldValue: oldValue ?? undefined, newValue: parsed });
}
