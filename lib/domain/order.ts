import { calculateCommission, type CommissionSettings } from "./commission";
import { DomainError } from "./errors";

export interface OrderSnapshotInput { buyerId: string; sellerId: string; productId: string; productTitle: string; productPriceKurus: number; settings: CommissionSettings }
export function createOrderSnapshot(input: OrderSnapshotInput) {
  if (input.buyerId === input.sellerId) throw new DomainError("SELF_PURCHASE", "Satıcı kendi ürününü satın alamaz");
  const amounts = calculateCommission(input.productPriceKurus, input.settings);
  return { buyerId: input.buyerId, sellerId: input.sellerId, productId: input.productId, productTitle: input.productTitle, productPriceKurus: input.productPriceKurus, commissionType: input.settings.type, commissionPercentageBasisPoints: input.settings.percentageBasisPoints, commissionFixedFeeKurus: input.settings.fixedFeeKurus, ...amounts, status: "PENDING_PAYMENT" as const };
}
