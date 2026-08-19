import type { AppUser } from "@/lib/auth";
import { calculateCommission } from "@/lib/domain/commission";
import { DomainError } from "@/lib/domain/errors";
import { database, ensureDatabase } from "@/lib/database";

export interface PersistentOrder { id: string; buyer_id: string; seller_id: string; product_title: string; product_price_kurus: number; platform_fee_kurus: number; seller_net_amount_kurus: number; payment_status: string; order_status: string; shipping_status: string; created_at: string }

export async function createPersistentOrder(user: AppUser, productId: string, legalDocumentIds: readonly string[]): Promise<string> {
  await ensureDatabase();
  const product = await database().prepare("SELECT id,seller_id,title,price_kurus,status FROM products WHERE id = ? LIMIT 1").bind(productId).first<{ id: string; seller_id: string; title: string; price_kurus: number; status: string }>();
  if (!product || product.status !== "ACTIVE") throw new DomainError("PRODUCT_UNAVAILABLE", "İlan satışa uygun değil");
  if (product.seller_id === user.id) throw new DomainError("SELF_PURCHASE", "Kendi ilanınızı satın alamazsınız");
  const documents = legalDocumentIds.length ? await database().prepare(`SELECT id FROM legal_documents WHERE active = 1 AND id IN (${legalDocumentIds.map(() => "?").join(",")})`).bind(...legalDocumentIds).all<{ id: string }>() : { results: [] as { id: string }[] };
  if (documents.results.length !== legalDocumentIds.length || legalDocumentIds.length < 2) throw new DomainError("LEGAL_REQUIRED", "Satın alma sözleşmelerini kabul etmelisiniz");
  const settings = await database().prepare("SELECT commission_type,percentage_basis_points,fixed_fee_kurus,minimum_fee_kurus,maximum_fee_kurus FROM platform_settings WHERE id = 1").first<{ commission_type: "PERCENTAGE" | "FIXED" | "HYBRID"; percentage_basis_points: number; fixed_fee_kurus: number; minimum_fee_kurus: number; maximum_fee_kurus: number | null }>();
  if (!settings) throw new Error("Platform ayarları bulunamadı");
  const commission = calculateCommission(product.price_kurus, { type: settings.commission_type, percentageBasisPoints: settings.percentage_basis_points, fixedFeeKurus: settings.fixed_fee_kurus, minimumFeeKurus: settings.minimum_fee_kurus, maximumFeeKurus: settings.maximum_fee_kurus });
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await database().batch([
    database().prepare("INSERT INTO orders (id,buyer_id,seller_id,product_id,product_title,product_price_kurus,platform_fee_kurus,seller_net_amount_kurus,payment_status,order_status,shipping_status,created_at) VALUES (?,?,?,?,?,?,?,?,'HELD','SELLER_PREPARING','NOT_READY',?)").bind(id, user.id, product.seller_id, product.id, product.title, product.price_kurus, commission.platformFeeKurus, commission.sellerNetAmountKurus, now),
    database().prepare("UPDATE products SET status = 'RESERVED', updated_at = ? WHERE id = ? AND status = 'ACTIVE'").bind(now, product.id),
  ]);
  return id;
}

export async function listPersistentOrders(userId: string): Promise<PersistentOrder[]> {
  await ensureDatabase();
  return (await database().prepare("SELECT id,buyer_id,seller_id,product_title,product_price_kurus,platform_fee_kurus,seller_net_amount_kurus,payment_status,order_status,shipping_status,created_at FROM orders WHERE buyer_id = ? OR seller_id = ? ORDER BY created_at DESC").bind(userId, userId).all<PersistentOrder>()).results;
}

export async function shipPersistentOrder(userId: string, orderId: string, company: string, trackingNumber: string): Promise<void> {
  await ensureDatabase();
  const result = await database().prepare("UPDATE orders SET order_status = 'SHIPPED', shipping_status = 'SHIPPED', shipping_company = ?, tracking_number = ? WHERE id = ? AND seller_id = ? AND order_status = 'SELLER_PREPARING'").bind(company, trackingNumber, orderId, userId).run();
  if (!result.meta.changes) throw new DomainError("INVALID_ORDER_STATE", "Sipariş kargoya verilemez");
}

export async function confirmPersistentDelivery(userId: string, orderId: string): Promise<void> {
  await ensureDatabase();
  const now = new Date().toISOString();
  const result = await database().prepare("UPDATE orders SET order_status = 'COMPLETED', shipping_status = 'DELIVERED', payment_status = 'RELEASED', completed_at = ? WHERE id = ? AND buyer_id = ? AND order_status IN ('SHIPPED','DELIVERED','BUYER_CONFIRMATION_PENDING') AND NOT EXISTS (SELECT 1 FROM disputes WHERE order_id = orders.id AND status != 'CLOSED')").bind(now, orderId, userId).run();
  if (!result.meta.changes) throw new DomainError("INVALID_ORDER_STATE", "Teslimat onaylanamadı");
  await database().prepare("UPDATE products SET status = 'SOLD', updated_at = ? WHERE id = (SELECT product_id FROM orders WHERE id = ?)").bind(now, orderId).run();
}

export async function openPersistentDispute(userId: string, orderId: string, reason: string, description: string): Promise<string> {
  await ensureDatabase();
  const order = await database().prepare("SELECT id FROM orders WHERE id = ? AND (buyer_id = ? OR seller_id = ?) AND order_status NOT IN ('REFUNDED','CANCELLED')").bind(orderId, userId, userId).first();
  if (!order) throw new DomainError("DISPUTE_FORBIDDEN", "Bu sipariş için uyuşmazlık açılamaz");
  const id = crypto.randomUUID();
  await database().batch([database().prepare("INSERT INTO disputes (id,order_id,opened_by,reason,description,status,created_at) VALUES (?,?,?,?,?,'OPEN',?)").bind(id, orderId, userId, reason, description, new Date().toISOString()), database().prepare("UPDATE orders SET order_status = 'DISPUTED' WHERE id = ?").bind(orderId)]);
  return id;
}
