import { ProductForm } from "@/components/product-form";
import { requireUser } from "@/lib/auth";
import { listCategories } from "@/lib/persistent-marketplace";

export const dynamic = "force-dynamic";
export default async function SellPage() { await requireUser("/sat"); const categories = await listCategories(); return <div className="dashboard-page listing-page"><div className="page-heading"><span className="kicker dark">YENİ İLAN</span><h1>Ürününü satışa çıkar</h1><p>İlan yayınlanmadan önce topluluk kurallarına göre incelenir.</p></div><div className="listing-layout"><ProductForm categories={categories}/><aside className="listing-guide"><b>İyi ilan nasıl olur?</b><ol><li>Ürünü farklı açılardan fotoğrafla</li><li>Kusurları açıkça belirt</li><li>Piyasa koşullarına uygun fiyat yaz</li><li>İletişim bilgilerini açıklamaya ekleme</li></ol><div><b>Doğrulama istenebilir</b><p>Platformun oluşturduğu kısa kodu ürünün yanında gösteren yeni bir kanıt fotoğrafı yüklemen gerekebilir.</p></div></aside></div></div>; }
