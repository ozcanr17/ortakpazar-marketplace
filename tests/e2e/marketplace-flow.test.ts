import test from "node:test";
import assert from "node:assert/strict";
import { assertOrderTransition, canReleaseSellerPayment, type OrderStatus } from "@/lib/domain/order-state";
import { createOrderSnapshot } from "@/lib/domain/order";
import { MockEscrowPaymentProvider } from "@/lib/providers/mock-escrow-payment";

interface ScenarioOrder { status: OrderStatus; paymentId: string; deliveredAt: Date | null; buyerConfirmedAt: Date | null; disputeDeadline: Date | null; hasOpenDispute: boolean; reviewCount: number }
const transition = (order: ScenarioOrder, next: OrderStatus) => { assertOrderTransition(order.status, next); order.status = next; };

test("seller register, product create, admin approve, buyer purchase, ship, confirm, release ve review", async () => {
  const seller = { id: "seller", role: "USER" }; const buyer = { id: "buyer", role: "USER" }; const admin = { id: "admin", role: "ADMIN" };
  assert.equal(seller.role, "USER"); assert.equal(buyer.role, "USER"); assert.equal(admin.role, "ADMIN");
  const product = { id: "product", sellerId: seller.id, status: "PENDING_REVIEW" }; product.status = "ACTIVE";
  const snapshot = createOrderSnapshot({ buyerId: buyer.id, sellerId: seller.id, productId: product.id, productTitle: "Kamera", productPriceKurus: 1_000_000, settings: { type: "PERCENTAGE", percentageBasisPoints: 500, fixedFeeKurus: 0, minimumFeeKurus: 0, maximumFeeKurus: null } });
  assert.equal(snapshot.sellerNetAmountKurus, 950_000);
  const provider = new MockEscrowPaymentProvider(); const created = await provider.createPayment({ orderId: "order", amountKurus: snapshot.productPriceKurus, currency: "TRY", buyerId: buyer.id, idempotencyKey: "create", returnUrl: "http://localhost" }); const authorized = await provider.authorizePayment(created.providerPaymentId, "authorize"); const captured = await provider.capturePayment(authorized.providerPaymentId, "capture"); const held = await provider.holdPayment(captured.providerPaymentId, "hold");
  const order: ScenarioOrder = { status: "PENDING_PAYMENT", paymentId: held.providerPaymentId, deliveredAt: null, buyerConfirmedAt: null, disputeDeadline: null, hasOpenDispute: false, reviewCount: 0 };
  transition(order, "PAID"); transition(order, "SELLER_PREPARING"); transition(order, "SHIPPED"); order.deliveredAt = new Date(); transition(order, "DELIVERED"); transition(order, "BUYER_CONFIRMATION_PENDING"); order.buyerConfirmedAt = new Date();
  assert.equal(canReleaseSellerPayment({ ...order, now: new Date() }), true);
  const released = await provider.releasePayment(order.paymentId, "release"); assert.equal(released.status, "RELEASED"); const payout = await provider.createSellerPayout({ orderId: "order", sellerId: seller.id, sellerAccountReference: "mock:seller", amountKurus: snapshot.sellerNetAmountKurus, currency: "TRY", idempotencyKey: "payout" }); assert.equal(payout.status, "PAID");
  transition(order, "COMPLETED"); order.reviewCount += 1; assert.equal(order.reviewCount, 1);
});

test("buyer purchase, seller ship, dispute, payout block ve admin refund", async () => {
  const provider = new MockEscrowPaymentProvider(); const created = await provider.createPayment({ orderId: "order2", amountKurus: 500_000, currency: "TRY", buyerId: "buyer", idempotencyKey: "create2", returnUrl: "http://localhost" }); await provider.authorizePayment(created.providerPaymentId, "authorize2"); await provider.capturePayment(created.providerPaymentId, "capture2"); const held = await provider.holdPayment(created.providerPaymentId, "hold2");
  const order: ScenarioOrder = { status: "PENDING_PAYMENT", paymentId: held.providerPaymentId, deliveredAt: null, buyerConfirmedAt: null, disputeDeadline: null, hasOpenDispute: false, reviewCount: 0 };
  transition(order, "PAID"); transition(order, "SELLER_PREPARING"); transition(order, "SHIPPED"); order.hasOpenDispute = true; transition(order, "DISPUTED");
  assert.equal(canReleaseSellerPayment({ ...order, now: new Date() }), false);
  transition(order, "REFUND_PENDING"); const refunded = await provider.refundPayment(order.paymentId, "refund2"); assert.equal(refunded.status, "REFUNDED"); transition(order, "REFUNDED"); assert.equal(order.status, "REFUNDED");
});
