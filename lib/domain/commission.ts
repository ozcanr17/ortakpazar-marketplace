import { DomainError } from "./errors";

export type CommissionType = "PERCENTAGE" | "FIXED" | "HYBRID";

export interface CommissionSettings {
  type: CommissionType;
  percentageBasisPoints: number;
  fixedFeeKurus: number;
  minimumFeeKurus: number;
  maximumFeeKurus: number | null;
}

export interface CommissionResult {
  platformFeeKurus: number;
  sellerNetAmountKurus: number;
}

const assertMoney = (value: number, field: string) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new DomainError("INVALID_MONEY", `${field} geçersiz`);
};

export function calculateCommission(productPriceKurus: number, settings: CommissionSettings): CommissionResult {
  assertMoney(productPriceKurus, "Ürün fiyatı");
  assertMoney(settings.fixedFeeKurus, "Sabit ücret");
  assertMoney(settings.minimumFeeKurus, "Minimum ücret");
  if (!Number.isInteger(settings.percentageBasisPoints) || settings.percentageBasisPoints < 0 || settings.percentageBasisPoints > 10000) throw new DomainError("INVALID_COMMISSION", "Komisyon oranı geçersiz");
  if (settings.maximumFeeKurus !== null) assertMoney(settings.maximumFeeKurus, "Maksimum ücret");
  const percentage = Math.round(productPriceKurus * settings.percentageBasisPoints / 10000);
  const raw = settings.type === "PERCENTAGE" ? percentage : settings.type === "FIXED" ? settings.fixedFeeKurus : percentage + settings.fixedFeeKurus;
  const withMinimum = Math.max(raw, settings.minimumFeeKurus);
  const platformFeeKurus = Math.min(withMinimum, settings.maximumFeeKurus ?? productPriceKurus, productPriceKurus);
  return { platformFeeKurus, sellerNetAmountKurus: productPriceKurus - platformFeeKurus };
}
