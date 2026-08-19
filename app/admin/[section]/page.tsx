import { notFound } from "next/navigation";
import { ProductAdminActions, SettingsForm, UserAdminActions } from "@/components/admin-controls";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/demo";
import { database, ensureDatabase } from "@/lib/database";
import { getPersistentDashboardMetrics } from "@/lib/admin-data";

const allowed = new Set(["users", "products", "orders", "disputes", "finance", "settings", "legal", "audit"]);

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!allowed.has(section)) notFound();
  await requireAdmin();
  await ensureDatabase();
  if (section === "users") {
    const users = (await database().prepare("SELECT id,email,first_name,last_name,role,status,created_at FROM users ORDER BY created_at DESC LIMIT 100").all<{ id: string; email: string; first_name: string; last_name: string; role: string; status: string; created_at: string }>()).results;
    return <AdminTable title="Kullanıcılar" headers={["Kullanıcı", "Rol", "Durum", "Kayıt", "Aksiyon"]}>{users.map((user) => <tr key={user.id}><td><b>{user.email}</b><small>{user.first_name} {user.last_name}</small></td><td>{user.role}</td><td>{user.status}</td><td>{new Date(user.created_at).toLocaleDateString("tr-TR")}</td><td><UserAdminActions userId={user.id}/></td></tr>)}</AdminTable>;
  }
  if (section === "products") {
    const products = (await database().prepare("SELECT p.id,p.title,p.price_kurus,p.status,p.location,p.created_at,u.email FROM products p JOIN users u ON u.id = p.seller_id ORDER BY p.created_at DESC LIMIT 100").all<{ id: string; title: string; price_kurus: number; status: string; location: string; created_at: string; email: string }>()).results;
    return <AdminTable title="İlanlar" headers={["İlan", "Fiyat", "Durum", "Satıcı", "Aksiyon"]}>{products.map((product) => <tr key={product.id}><td><b>{product.title}</b><small>{product.location}</small></td><td>{formatMoney(product.price_kurus)}</td><td>{product.status}</td><td>{product.email}</td><td><ProductAdminActions productId={product.id}/></td></tr>)}</AdminTable>;
  }
  if (section === "orders") {
    const orders = (await database().prepare("SELECT id,product_title,product_price_kurus,order_status,payment_status,shipping_status,created_at FROM orders ORDER BY created_at DESC LIMIT 100").all<{ id: string; product_title: string; product_price_kurus: number; order_status: string; payment_status: string; shipping_status: string; created_at: string }>()).results;
    return <AdminTable title="Siparişler" headers={["Sipariş", "Tutar", "Durum", "Ödeme", "Kargo"]}>{orders.map((order) => <tr key={order.id}><td><b>{order.product_title}</b><small>{order.id}</small></td><td>{formatMoney(order.product_price_kurus)}</td><td>{order.order_status}</td><td>{order.payment_status}</td><td>{order.shipping_status}</td></tr>)}</AdminTable>;
  }
  if (section === "finance") {
    const metrics = await getPersistentDashboardMetrics();
    return <><div className="admin-heading"><h1>Finans</h1><p>Tüm tutarlar kuruş tabanlı sunucu kayıtlarından hesaplanır.</p></div><div className="metric-grid"><article><small>İşlem hacmi</small><b>{formatMoney(metrics.volumeKurus)}</b></article><article><small>Platform komisyonu</small><b>{formatMoney(metrics.revenueKurus)}</b></article><article><small>Satıcıya ödenecek</small><b>{formatMoney(metrics.sellerPayableKurus)}</b></article><article><small>Ödenen satıcı tutarı</small><b>{formatMoney(metrics.paidSellerKurus)}</b></article></div></>;
  }
  if (section === "settings") {
    const row = await database().prepare("SELECT commission_type,percentage_basis_points,fixed_fee_kurus,minimum_fee_kurus,maximum_fee_kurus,maintenance_mode FROM platform_settings WHERE id = 1").first<{ commission_type: "PERCENTAGE" | "FIXED" | "HYBRID"; percentage_basis_points: number; fixed_fee_kurus: number; minimum_fee_kurus: number; maximum_fee_kurus: number | null; maintenance_mode: number }>();
    if (!row) return <p>Ayarlar bulunamadı.</p>;
    return <><div className="admin-heading"><h1>Platform ayarları</h1><p>Komisyon oranı ve operasyon sürelerini yönetin.</p></div><SettingsForm settings={{ ...row, maintenance_mode: row.maintenance_mode === 1, dispute_period_hours: 48, seller_shipping_deadline_hours: 72, buyer_confirmation_period_hours: 48, prohibited_categories: [] }}/></>;
  }
  if (section === "legal") {
    const documents = (await database().prepare("SELECT id,type,version,title,active,published_at FROM legal_documents ORDER BY published_at DESC").all<{ id: string; type: string; version: string; title: string; active: number; published_at: string }>()).results;
    return <><div className="admin-heading"><h1>Hukuki metinler</h1><p>Mevcut sürümler production öncesinde hukuk danışmanı tarafından doğrulanmalıdır.</p></div><div className="admin-list">{documents.map((document) => <article key={document.id}><b>{document.title}</b><span>{document.type} · v{document.version} · {document.active ? "Aktif" : "Arşiv"}</span></article>)}</div></>;
  }
  if (section === "audit") {
    const logs = (await database().prepare("SELECT id,actor_id,action,target_type,target_id,created_at FROM audit_logs ORDER BY created_at DESC LIMIT 200").all<{ id: string; actor_id: string | null; action: string; target_type: string; target_id: string; created_at: string }>()).results;
    return <AdminTable title="Audit kayıtları" headers={["Aksiyon", "Hedef", "Aktör", "Zaman"]}>{logs.map((log) => <tr key={log.id}><td><b>{log.action}</b></td><td>{log.target_type}<small>{log.target_id}</small></td><td>{log.actor_id ?? "Sistem"}</td><td>{new Date(log.created_at).toLocaleString("tr-TR")}</td></tr>)}</AdminTable>;
  }
  return <div className="admin-heading"><h1>{section === "disputes" ? "Uyuşmazlıklar" : "Yönetim"}</h1><p>Henüz kayıt bulunmuyor.</p></div>;
}

function AdminTable({ title, headers, children }: { title: string; headers: string[]; children: React.ReactNode }) { return <><div className="admin-heading"><h1>{title}</h1></div><div className="admin-table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div></>; }
