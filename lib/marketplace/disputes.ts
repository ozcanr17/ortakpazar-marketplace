import { z } from "zod";
import type { AppUser } from "@/lib/auth";
import { AuthorizationError, DomainError } from "@/lib/domain/errors";
import { getPaymentProvider } from "@/lib/providers/payment";
import { sanitizeText } from "@/lib/security/text";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { appendAuditLog } from "@/lib/audit";

const disputeSchema = z.object({ orderId: z.string().uuid(), reason: z.enum(["ITEM_NOT_RECEIVED", "ITEM_NOT_AS_DESCRIBED", "DAMAGED", "COUNTERFEIT", "PAYMENT", "RETURN", "OTHER"]), description: z.string().min(20).max(5000) });

export async function openDispute(user: AppUser, input: z.input<typeof disputeSchema>): Promise<string> {
  const parsed = disputeSchema.parse(input);
  const { data, error } = await createSupabaseAdminClient().rpc("open_order_dispute", { p_order_id: parsed.orderId, p_opened_by: user.id, p_reason: parsed.reason, p_description: sanitizeText(parsed.description, 5000) });
  if (error || typeof data !== "string") throw new DomainError("DISPUTE_FAILED", "Uyuşmazlık açılamadı");
  return data;
}

export async function resolveDispute(admin: AppUser, input: { disputeId: string; resolution: "REFUND" | "PARTIAL_REFUND" | "RELEASE"; amountKurus?: number; note: string }): Promise<void> {
  if (!["ADMIN", "SUPER_ADMIN"].includes(admin.role)) throw new AuthorizationError();
  const parsed = z.object({ disputeId: z.string().uuid(), resolution: z.enum(["REFUND", "PARTIAL_REFUND", "RELEASE"]), amountKurus: z.number().int().positive().optional(), note: z.string().min(5).max(3000) }).parse(input);
  const client = createSupabaseAdminClient();
  const { data: dispute } = await client.from("disputes").select("id,order_id,status").eq("id", parsed.disputeId).single();
  if (!dispute || !["OPEN", "UNDER_REVIEW", "WAITING_BUYER", "WAITING_SELLER"].includes(dispute.status)) throw new DomainError("INVALID_DISPUTE", "Uyuşmazlık çözümlenemez");
  const { data: order } = await client.from("orders").select("product_price_kurus,seller_net_amount_kurus").eq("id", dispute.order_id).single();
  if (!order) throw new DomainError("ORDER_NOT_FOUND", "Sipariş bulunamadı");
  const { data: payment } = await client.from("payments").select("provider_payment_id,status").eq("order_id", dispute.order_id).single();
  if (!payment) throw new DomainError("PAYMENT_NOT_FOUND", "Ödeme bulunamadı");
  const provider = getPaymentProvider();
  if (parsed.resolution === "REFUND") {
    await provider.refundPayment(payment.provider_payment_id, `dispute:${parsed.disputeId}:refund`);
    await client.from("orders").update({ order_status: "REFUNDED", payment_status: "REFUNDED" }).eq("id", dispute.order_id);
  } else if (parsed.resolution === "PARTIAL_REFUND") {
    const amount = parsed.amountKurus;
    if (!amount || amount >= order.product_price_kurus) throw new DomainError("INVALID_REFUND", "Kısmi iade tutarı geçersiz");
    await provider.partialRefund(payment.provider_payment_id, amount, `dispute:${parsed.disputeId}:partial:${amount}`);
    await client.from("orders").update({ order_status: "COMPLETED", payment_status: "PARTIALLY_REFUNDED" }).eq("id", dispute.order_id);
  } else {
    await provider.releasePayment(payment.provider_payment_id, `dispute:${parsed.disputeId}:release`);
    await client.from("orders").update({ order_status: "COMPLETED", payment_status: "RELEASED", completed_at: new Date().toISOString() }).eq("id", dispute.order_id);
  }
  await client.from("disputes").update({ status: parsed.resolution === "RELEASE" ? "RESOLVED_SELLER" : "RESOLVED_BUYER", resolution: sanitizeText(parsed.note, 3000), resolved_at: new Date().toISOString(), assigned_admin: admin.id }).eq("id", parsed.disputeId);
  await appendAuditLog({ actorId: admin.id, action: `DISPUTE_${parsed.resolution}`, targetType: "DISPUTE", targetId: parsed.disputeId, newValue: { amountKurus: parsed.amountKurus ?? null, note: sanitizeText(parsed.note, 3000) } });
}
