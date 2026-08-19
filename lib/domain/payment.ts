export type PaymentStatus = "CREATED" | "AUTHORIZED" | "CAPTURED" | "HELD" | "RELEASED" | "PARTIALLY_REFUNDED" | "REFUNDED" | "CANCELLED" | "FAILED";
export type PayoutStatus = "PENDING" | "PROCESSING" | "PAID" | "FAILED" | "CANCELLED";

export interface PaymentRequest {
  orderId: string;
  amountKurus: number;
  currency: "TRY";
  buyerId: string;
  idempotencyKey: string;
  returnUrl: string;
}

export interface PaymentResult {
  providerPaymentId: string;
  status: PaymentStatus;
  hostedPaymentUrl: string | null;
  token: string | null;
}

export interface PayoutRequest {
  orderId: string;
  sellerId: string;
  sellerAccountReference: string;
  amountKurus: number;
  currency: "TRY";
  idempotencyKey: string;
}

export interface PayoutResult {
  providerPayoutId: string;
  status: PayoutStatus;
}

export interface PaymentProvider {
  readonly name: string;
  createPayment(request: PaymentRequest): Promise<PaymentResult>;
  authorizePayment(paymentId: string, idempotencyKey: string): Promise<PaymentResult>;
  capturePayment(paymentId: string, idempotencyKey: string): Promise<PaymentResult>;
  holdPayment(paymentId: string, idempotencyKey: string): Promise<PaymentResult>;
  releasePayment(paymentId: string, idempotencyKey: string): Promise<PaymentResult>;
  refundPayment(paymentId: string, idempotencyKey: string): Promise<PaymentResult>;
  partialRefund(paymentId: string, amountKurus: number, idempotencyKey: string): Promise<PaymentResult>;
  cancelPayment(paymentId: string, idempotencyKey: string): Promise<PaymentResult>;
  getPaymentStatus(paymentId: string): Promise<PaymentResult>;
  createSellerPayout(request: PayoutRequest): Promise<PayoutResult>;
  getPayoutStatus(payoutId: string): Promise<PayoutResult>;
}
