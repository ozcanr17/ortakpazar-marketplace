import { DomainError } from "./errors";

export const orderStatuses = ["PENDING_PAYMENT", "PAID", "SELLER_PREPARING", "SHIPPED", "DELIVERED", "BUYER_CONFIRMATION_PENDING", "COMPLETED", "DISPUTED", "REFUND_PENDING", "REFUNDED", "CANCELLED"] as const;
export type OrderStatus = typeof orderStatuses[number];

const transitions: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["SELLER_PREPARING", "CANCELLED", "DISPUTED", "REFUND_PENDING"],
  SELLER_PREPARING: ["SHIPPED", "CANCELLED", "DISPUTED", "REFUND_PENDING"],
  SHIPPED: ["DELIVERED", "DISPUTED"],
  DELIVERED: ["BUYER_CONFIRMATION_PENDING", "DISPUTED"],
  BUYER_CONFIRMATION_PENDING: ["COMPLETED", "DISPUTED"],
  COMPLETED: ["DISPUTED"],
  DISPUTED: ["REFUND_PENDING", "COMPLETED"],
  REFUND_PENDING: ["REFUNDED"],
  REFUNDED: [],
  CANCELLED: [],
};

export function assertOrderTransition(current: OrderStatus, next: OrderStatus): void {
  if (!transitions[current].includes(next)) throw new DomainError("INVALID_ORDER_TRANSITION", `${current} durumundan ${next} durumuna geçilemez`);
}

export function canReleaseSellerPayment(input: { status: OrderStatus; deliveredAt: Date | null; buyerConfirmedAt: Date | null; disputeDeadline: Date | null; hasOpenDispute: boolean; now: Date }): boolean {
  if (input.hasOpenDispute || !input.deliveredAt) return false;
  if (input.buyerConfirmedAt) return input.status === "BUYER_CONFIRMATION_PENDING" || input.status === "COMPLETED";
  return input.status === "BUYER_CONFIRMATION_PENDING" && input.disputeDeadline !== null && input.now >= input.disputeDeadline;
}
