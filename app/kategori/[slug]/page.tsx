import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { demoCategories } from "@/lib/demo";
import { listPersistentProducts } from "@/lib/persistent-marketplace";

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = demoCategories.find((item) => item.slug === slug);
  const products = await listPersistentProducts({ category: slug });
  return <div className="catalog-page"><div className="catalog-head"><span className="kicker dark">KATEGORİ</span><h1>{category?.name ?? "Ürünler"}</h1><p>Bu kategoride yayında olan onaylı ilanlar.</p></div><div className="result-row"><span>{products.length} ilan</span><Link prefetch={false} href="/urunler">Tüm ürünler →</Link></div><div className="market-grid three">{products.map((product) => <ProductCard key={product.id} product={product}/>)}{products.length === 0 && <div className="empty-state"><h2>Henüz ilan yok</h2><p>Diğer kategorilere göz atabilirsiniz.</p></div>}</div></div>;
}
