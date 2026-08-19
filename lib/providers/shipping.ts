export interface ShipmentInput { orderId: string; company: string; trackingNumber: string; shippedAt: Date }
export interface ShipmentResult { provider: string; status: "SHIPPED" | "IN_TRANSIT" | "DELIVERED"; trackingNumber: string }
export interface ShippingProvider { createShipment(input: ShipmentInput): Promise<ShipmentResult>; getTracking(trackingNumber: string): Promise<ShipmentResult> }

export class ManualShippingProvider implements ShippingProvider {
  private readonly shipments = new Map<string, ShipmentResult>();
  async createShipment(input: ShipmentInput): Promise<ShipmentResult> { const result = { provider: "MANUAL", status: "SHIPPED" as const, trackingNumber: input.trackingNumber }; this.shipments.set(input.trackingNumber, result); return result; }
  async getTracking(trackingNumber: string): Promise<ShipmentResult> { return this.shipments.get(trackingNumber) ?? { provider: "MANUAL", status: "SHIPPED", trackingNumber }; }
}
