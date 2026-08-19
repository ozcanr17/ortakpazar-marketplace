import { createHash } from "node:crypto";
import { z } from "zod";
import type { AppUser } from "@/lib/auth";
import { AuthorizationError, DomainError } from "@/lib/domain/errors";
import { getPaymentProvider } from "@/lib/providers/payment";
import { ManualShippingProvider } from "@/lib/providers/shipping";
import { sanitizeText } from "@/lib/security/text";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const shippingProvider = new ManualShippingProvider();

export async function createOrder(user: AppUser, productId: string, legalDocumentIds: readonly string[], idempotencyKey: string, returnUrl: string): Promise<string> {
  const parsed = z.object({ productId: z.string().uuid(), legalDocumentIds: z.array(z.string().uuid()).min(2), idempotencyKey: z.string().min(16).max(160), returnUrl: z.string().url() }).parse({ productId, legalDocumentIds, idempotencyKey, returnUrl });
  const client = createSupabaseAdminClient();
  const { data: accepted } = await client.from("legal_acceptances").select("document_id").eq("user_id", user.id).in("document_id", parsed.legalDocumentIds);
  if (!accepted || accepted.length !== parsed.legalDocumentIds.length) throw new DomainError("LEGAL_ACCEPTANCE_REQUIRED", "Güncel sözleşmeler kabul edilmelidir");
  const requestHash = createHash("sha256").update(JSON.stringify({ buyerId: user.id, productId: parsed.productId, legalDocumentIds: [...parsed.legalDocumentIds].sort() })).digest("hex");
  const { data: orderId, error } = await client.rpc("create_marketplace_order", { p_buyer_id: user.id, p_product_id: parsed.productId, p_legal_document_ids: parsed.legalDocumentIds, p_idempotency_key: parsed.idempotencyKey, p_request_hash: requestHash });
  if (error || typeof orderId !== "string") throw new DomainError("ORDER_CREATE_FAILED", "Sipariş oluşturulamadı veya ürün artık müsait değil");
  const { data: order } = await client.from("orders").select("id,product_price_kurus,payment_status,order_status").eq("id", orderId).single();
  if (!order) throw new DomainError("ORDER_NOT_FOUND", "Sipariş bulunamadı");
  if (order.payment_status !== "CREATED" || order.order_status !== "PENDING_PAYMENT") return orderId;
  const provider = getPaymentProvider();
  const payment = await provider.createPayment({ orderId, amountKurus: order.product_price_kurus, currency: "TRY", buyerId: user.id, idempotencyKey: `${parsed.idempotencyKey}:create`, returnUrl: parsed.returnUrl });
  const authorized = await provider.authorizePayment(payment.providerPaymentId, `${parsed.idempotencyKey}:authorize`);
  const captured = await provider.capturePayment(authorized.providerPaymentId, `${parsed.idempotencyKey}:capture`);
  const held = await provider.holdPayment(captured.providerPaymentId, `${parsed.idempotencyKey}:hold`);
  const { error: paymentError } = await client.from("payments").insert({ order_id: orderId, provider: provider.name, provider_payment_id: held.providerPaymentId, amount_kurus: order.product_price_kurus, currency: "TRY", status: held.status, idempotency_key: parsed.idempotencyKey });
  if (paymentError) {
    await provider.refundPayment(held.providerPaymentId, `${parsed.idempotencyKey}:compensate`);
    throw new DomainError("PAYMENT_RECORD_FAILED", "Ödeme kaydedilemedi ve iade akışı başlatıldı");
  }
  await client.from("orders").update({ payment_status: held.status, order_status: "PAID" }).eq("id", orderId).eq("order_status", "PENDING_PAYMENT");
  await client.rpc("transition_order", { p_order_id: orderId, p_expected: "PAID", p_next: "SELLER_PREPARING" });
  return orderId;
}

export async function shipOrder(user: AppUser, input: { orderId: string; company: string; trackingNumber: string; shippedAt: Date }): Promise<void> {
  const parsed = z.object({ orderId: z.string().uuid(), company: z.string().min(2).max(100), trackingNumber: z.string().min(4).max(120), shippedAt: z.date().max(new Date()) }).parse(input);
  const client = createSupabaseAdminClient();
  const { data: order } = await client.from("orders").select("seller_id,order_status").eq("id", parsed.orderId).single();
  if (!order || order.seller_id !== user.id) throw new AuthorizationError();
  if (order.order_status !== "SELLER_PREPARING") throw new DomainError("INVALID_ORDER_STATE", "Sipariş kargoya verilemez");
  const shipment = await shippingProvider.createShipment({ orderId: parsed.orderId, company: sanitizeText(parsed.company, 100), trackingNumber: sanitizeText(parsed.trackingNumber, 120), shippedAt: parsed.shippedAt });
  const { error } = await client.rpc("record_manual_shipment", { p_order_id: parsed.orderId, p_seller_id: user.id, p_company: parsed.company, p_tracking_number: shipment.trackingNumber, p_shipped_at: parsed.shippedAt.toISOString() });
  if (error) throw new DomainError("SHIPPING_FAILED", "Kargo bilgisi kaydedilemedi");
}

export async function confirmDelivery(user: AppUser, orderId: string): Promise<void> {
  const id = z.string().uuid().parse(orderId);
  const { error } = await createSupabaseAdminClient().rpc("buyer_confirm_delivery", { p_order_id: id, p_buyer_id: user.id });
  if (error) throw new DomainError("CONFIRMATION_FAILED", "Teslimat onaylanamadı");
}

export async function releaseSellerPayout(adminUser: AppUser | null, orderId: string, idempotencyKey: string): Promise<void> {
  const client = createSupabaseAdminClient();
  const { data: payoutId, error } = await client.rpc("prepare_seller_payout", { p_order_id: orderId, p_idempotency_key: idempotencyKey });
  if (error || typeof payoutId !== "string") throw new DomainError("PAYOUT_BLOCKED", "Satıcı ödemesi koşulları oluşmadı");
  const { data: payout } = await client.from("payouts").select("id,order_id,seller_id,amount_kurus,idempotency_key,status").eq("id", payoutId).single();
  const { data: seller } = payout ? await client.from("seller_profiles").select("payout_account_reference").eq("user_id", payout.seller_id).single() : { data: null };
  if (!payout || !seller?.payout_account_reference) throw new DomainError("PAYOUT_ACCOUNT_REQUIRED", "Satıcı ödeme hesabı doğrulanmamış");
  if (payout.status === "PAID") return;
  const provider = getPaymentProvider();
  const result = await provider.createSellerPayout({ orderId: payout.order_id, sellerId: payout.seller_id, sellerAccountReference: seller.payout_account_reference, amountKurus: payout.amount_kurus, currency: "TRY", idempotencyKey: payout.idempotency_key });
  await client.from("payouts").update({ provider_payout_id: result.providerPayoutId, status: result.status }).eq("id", payout.id);
  await client.from("orders").update({ payment_status: "RELEASED", order_status: "COMPLETED", completed_at: new Date().toISOString() }).eq("id", payout.order_id);
  if (adminUser && !["MODERATOR", "ADMIN", "SUPER_ADMIN"].includes(adminUser.role)) throw new AuthorizationError();
}

export async function listUserOrders(user: AppUser) {
  const { data, error } = await createSupabaseAdminClient().from("orders").select("id,buyer_id,seller_id,product_title,product_price_kurus,platform_fee_kurus,seller_net_amount_kurus,payment_status,order_status,shipping_status,created_at,shipping:shipping_records(shipping_company,tracking_number,shipped_at,delivered_at)").or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`).order("created_at", { ascending: false });
  if (error) throw new Error("Siparişler yüklenemedi");
  return data;
}
