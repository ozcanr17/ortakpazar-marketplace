import { DomainError } from "@/lib/domain/errors";
import type { PaymentProvider, PaymentRequest, PaymentResult, PaymentStatus, PayoutRequest, PayoutResult } from "@/lib/domain/payment";

const paymentNext: Record<PaymentStatus, readonly PaymentStatus[]> = {
  CREATED: ["AUTHORIZED", "CANCELLED"], AUTHORIZED: ["CAPTURED", "CANCELLED"], CAPTURED: ["HELD", "REFUNDED", "PARTIALLY_REFUNDED"], HELD: ["RELEASED", "REFUNDED", "PARTIALLY_REFUNDED"], RELEASED: ["REFUNDED", "PARTIALLY_REFUNDED"], PARTIALLY_REFUNDED: ["REFUNDED", "RELEASED"], REFUNDED: [], CANCELLED: [], FAILED: [],
};

export class MockEscrowPaymentProvider implements PaymentProvider {
  readonly name = "mock-escrow";
  private readonly payments = new Map<string, PaymentResult>();
  private readonly payouts = new Map<string, PayoutResult>();
  private readonly idempotency = new Map<string, PaymentResult | PayoutResult>();

  private paymentResult(id: string): PaymentResult {
    const payment = this.payments.get(id);
    if (!payment) throw new DomainError("PAYMENT_NOT_FOUND", "Ödeme bulunamadı");
    return payment;
  }

  private transition(paymentId: string, next: PaymentStatus, key: string): PaymentResult {
    const cached = this.idempotency.get(key);
    if (cached && "providerPaymentId" in cached) return cached;
    const current = this.paymentResult(paymentId);
    if (!paymentNext[current.status].includes(next)) throw new DomainError("INVALID_PAYMENT_TRANSITION", `${current.status} durumundan ${next} durumuna geçilemez`);
    const result = { ...current, status: next };
    this.payments.set(paymentId, result);
    this.idempotency.set(key, result);
    return result;
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    const cached = this.idempotency.get(request.idempotencyKey);
    if (cached && "providerPaymentId" in cached) return cached;
    const result: PaymentResult = { providerPaymentId: crypto.randomUUID(), status: "CREATED", hostedPaymentUrl: null, token: crypto.randomUUID() };
    this.payments.set(result.providerPaymentId, result);
    this.idempotency.set(request.idempotencyKey, result);
    return result;
  }

  async authorizePayment(id: string, key: string) { return this.transition(id, "AUTHORIZED", key); }
  async capturePayment(id: string, key: string) { return this.transition(id, "CAPTURED", key); }
  async holdPayment(id: string, key: string) { return this.transition(id, "HELD", key); }
  async releasePayment(id: string, key: string) { return this.transition(id, "RELEASED", key); }
  async refundPayment(id: string, key: string) { return this.transition(id, "REFUNDED", key); }
  async partialRefund(id: string, amountKurus: number, key: string) { if (!Number.isSafeInteger(amountKurus) || amountKurus <= 0) throw new DomainError("INVALID_REFUND", "İade tutarı geçersiz"); return this.transition(id, "PARTIALLY_REFUNDED", key); }
  async cancelPayment(id: string, key: string) { return this.transition(id, "CANCELLED", key); }
  async getPaymentStatus(id: string) { return this.paymentResult(id); }

  async createSellerPayout(request: PayoutRequest): Promise<PayoutResult> {
    const cached = this.idempotency.get(request.idempotencyKey);
    if (cached && "providerPayoutId" in cached) return cached;
    const result: PayoutResult = { providerPayoutId: crypto.randomUUID(), status: "PAID" };
    this.payouts.set(result.providerPayoutId, result);
    this.idempotency.set(request.idempotencyKey, result);
    return result;
  }

  async getPayoutStatus(id: string): Promise<PayoutResult> {
    const payout = this.payouts.get(id);
    if (!payout) throw new DomainError("PAYOUT_NOT_FOUND", "Satıcı ödemesi bulunamadı");
    return payout;
  }
}
