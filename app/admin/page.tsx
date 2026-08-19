import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/demo";
import { getPersistentDashboardMetrics } from "@/lib/admin-data";

export default async function AdminPage() {
  await requireAdmin();
  const metrics = await getPersistentDashboardMetrics();
  const items = [{ label: "Toplam kullanıcı", value: metrics.totalUsers }, { label: "Aktif ilan", value: metrics.activeProducts }, { label: "Bekleyen ilan", value: metrics.pendingProducts }, { label: "Toplam sipariş", value: metrics.totalOrders }, { label: "İşlem hacmi", value: formatMoney(metrics.volumeKurus) }, { label: "Platform geliri", value: formatMoney(metrics.revenueKurus) }, { label: "Bekleyen ödeme", value: formatMoney(metrics.pendingPayoutKurus) }, { label: "Açık uyuşmazlık", value: metrics.openDisputes }];
  return <><div className="admin-heading"><span className="kicker dark">YÖNETİM</span><h1>Dashboard</h1><p>Kullanıcı, ilan ve işlem hareketlerini tek ekrandan yönetin.</p></div><div className="metric-grid">{items.map((item) => <article key={item.label}><small>{item.label}</small><b>{item.value}</b></article>)}</div><div className="legal-warning">Production ödeme, hukuk ve uyumluluk kontrolleri yetkili insan incelemesi tamamlanmadan aktif edilmemelidir.</div></>;
}
