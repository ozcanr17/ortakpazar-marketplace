import type { PaymentProvider } from "@/lib/domain/payment";
import { MockEscrowPaymentProvider } from "./mock-escrow-payment";

let developmentProvider: MockEscrowPaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  const provider = process.env.PAYMENT_PROVIDER ?? "mock";
  if (provider === "mock" && process.env.NODE_ENV !== "production") {
    developmentProvider ??= new MockEscrowPaymentProvider();
    return developmentProvider;
  }
  throw new Error("Lisanslı production ödeme sağlayıcısı yapılandırılmadan ödeme işlemi başlatılamaz");
}
