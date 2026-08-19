import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { demoCategories, demoProducts } from "@/lib/demo";
import { listPersistentProducts } from "@/lib/persistent-marketplace";

export const metadata: Metadata = { title: "Ürünler", description: "OrtakPazar'daki güvenli ve doğrulanabilir C2C ilanlarını keşfedin." };
export const dynamic = "force-dynamic";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams; const query = typeof params.q === "string" ? params.q : ""; const category = typeof params.kategori === "string" ? params.kategori : ""; const condition = typeof params.kondisyon === "string" ? params.kondisyon : "";
  const remote = await listPersistentProducts({ query, category, condition }).catch(() => []);
  const fallback = demoProducts.filter((product) => (!query || product.title.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR"))) && (!category || product.categorySlug === category) && (!condition || product.condition === condition));
  const products = remote.length ? remote : fallback;
  return <div className="catalog-page"><div className="catalog-head"><div><span className="kicker dark">KEŞFET</span><h1>Sana uygun ürünü bul</h1><p>İlanları, satıcıları ve doğrulama durumunu karşılaştır.</p></div><form className="catalog-search"><input name="q" defaultValue={query} placeholder="Ne arıyorsun?"/><select name="kategori" defaultValue={category}><option value="">Tüm kategoriler</option>{demoCategories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select><select name="kondisyon" defaultValue={condition}><option value="">Tüm kondisyonlar</option><option value="NEW">Sıfır</option><option value="LIKE_NEW">Yeni gibi</option><option value="GOOD">İyi</option><option value="FAIR">Kullanılmış</option></select><button className="button primary">Ara</button></form></div><div className="catalog-layout"><aside><b>Kategoriler</b><Link href="/urunler">Tüm ilanlar</Link>{demoCategories.map((item) => <Link key={item.slug} href={`/urunler?kategori=${item.slug}`}>{item.name}</Link>)}<div className="buyer-note"><i>✓</i><b>Alıcı koruması</b><p>Ödeme release koşulları teslimat ve uyuşmazlık durumuna bağlıdır.</p></div></aside><div><div className="result-row"><span>{products.length} ilan</span><select aria-label="Sıralama"><option>En yeni</option><option>Fiyat: düşükten yükseğe</option><option>Fiyat: yüksekten düşüğe</option></select></div><div className="market-grid three">{products.map((product) => <ProductCard key={product.id} product={product}/>)}</div>{products.length === 0 && <div className="empty-state"><h2>Sonuç bulunamadı</h2><p>Filtreleri değiştirerek yeniden deneyin.</p></div>}</div></div></div>;
}
