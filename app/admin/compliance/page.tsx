import { requireAdmin } from "@/lib/auth";

const items = ["6563 Elektronik Ticaret mevzuatı", "ETBİS değerlendirmesi ve kayıt durumu", "6502 Tüketicinin Korunması", "Mesafeli Sözleşmeler Yönetmeliği", "KVKK ve çerez yönetimi", "İYS değerlendirmesi", "Vergi ve fatura süreçleri", "Yasaklı ürün politikası", "Ödeme kuruluşu sözleşmesi", "Payout ve iade süreçleri", "Veri ihlali prosedürü", "Hukuk danışmanı onayı"];

export default async function CompliancePage() { await requireAdmin(); return <><div className="admin-heading"><span className="kicker dark">TÜRKİYE UYUMLULUK</span><h1>Compliance checklist</h1><p>Bu liste hukuki tavsiye veya uygunluk onayı değildir. Her madde yetkin hukuk, vergi ve ödeme uzmanlarınca doğrulanmalıdır.</p></div><div className="admin-list">{items.map((item) => <article key={item}><b>{item}</b><span>İnsan incelemesi gerekli</span></article>)}</div></>; }
