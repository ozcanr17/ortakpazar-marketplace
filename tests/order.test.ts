import test from "node:test";
import assert from "node:assert/strict";
import { createOrderSnapshot } from "@/lib/domain/order";
import { assertOrderTransition, canReleaseSellerPayment } from "@/lib/domain/order-state";

test("sipariş fiyat ve komisyon snapshot oluşturur", () => { const order = createOrderSnapshot({ buyerId: "buyer", sellerId: "seller", productId: "product", productTitle: "Ürün", productPriceKurus: 1_000_000, settings: { type: "PERCENTAGE", percentageBasisPoints: 500, fixedFeeKurus: 0, minimumFeeKurus: 0, maximumFeeKurus: null } }); assert.equal(order.platformFeeKurus, 50_000); assert.equal(order.sellerNetAmountKurus, 950_000); });
test("kendi ürününü satın almayı reddeder", () => { assert.throws(() => createOrderSnapshot({ buyerId: "same", sellerId: "same", productId: "product", productTitle: "Ürün", productPriceKurus: 100, settings: { type: "FIXED", percentageBasisPoints: 0, fixedFeeKurus: 0, minimumFeeKurus: 0, maximumFeeKurus: null } })); });
test("geçersiz state transition reddedilir", () => { assert.throws(() => assertOrderTransition("PENDING_PAYMENT", "COMPLETED")); });
test("açık dispute payout işlemini engeller", () => { assert.equal(canReleaseSellerPayment({ status: "BUYER_CONFIRMATION_PENDING", deliveredAt: new Date(), buyerConfirmedAt: new Date(), disputeDeadline: new Date(), hasOpenDispute: true, now: new Date() }), false); });
test("teslimat ve alıcı onayı release koşulunu sağlar", () => { assert.equal(canReleaseSellerPayment({ status: "BUYER_CONFIRMATION_PENDING", deliveredAt: new Date(), buyerConfirmedAt: new Date(), disputeDeadline: null, hasOpenDispute: false, now: new Date() }), true); });
