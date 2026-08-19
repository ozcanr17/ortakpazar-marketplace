import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductActions } from "@/components/product-actions";
import { conditionLabel, demoProducts, formatMoney, type CatalogProduct } from "@/lib/demo";
import { getPersistentProduct } from "@/lib/persistent-marketplace";
import { database, ensureDatabase } from "@/lib/database";

export const dynamic = "force-dynamic";

async function loadProduct(slug: string): Promise<CatalogProduct & { sellerId: string }> {
  const product = await getPersistentProduct(slug).catch(() => null);
  if (product) return product;
  const demo = demoProducts.find((item) => item.slug === slug);
  if (demo) return { ...demo, sellerId: "a1111111-1111-4111-8111-111111111111" };
  notFound();
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const product = await loadProduct(slug).catch(() => null);
  if (!product) return { title: "İlan bulunamadı", description: "İlan artık yayında değil.", openGraph: { images: [] }, twitter: { images: [] } };
  return { title: product.title, description: product.description.slice(0, 150), openGraph: { title: product.title, description: product.description.slice(0, 150), images: [{ url: product.image }] }, twitter: { title: product.title, description: product.description.slice(0, 150), images: [product.image] } };
}

async function getCheckoutDocuments() { await ensureDatabase(); return (await database().prepare("SELECT id,title,type FROM legal_documents WHERE active = 1 AND type IN ('DISTANCE_SALES_INFORMATION','DISTANCE_SALES_AGREEMENT_TEMPLATE')").all<{ id: string; title: string; type: string }>()).results; }

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const product = await loadProduct(slug);
  const legalDocuments = await getCheckoutDocuments();
  return <div className="product-page"><div className="breadcrumbs">Ana sayfa / {product.category} / {product.title}</div><div className="product-layout"><div className="product-gallery"><div className="main-image"><img src={product.image} alt={product.title}/>{product.verified && <span className="verified-badge">✓ Fiziksel ürün doğrulandı</span>}</div><div className="thumbnail-row"><button><img src={product.image} alt="Ürün fotoğrafı 1"/></button></div></div><div className="product-detail"><span className="condition-pill">{conditionLabel[product.condition]}</span><h1>{product.title}</h1><p className="product-location">{product.location} · Bugün güncellendi</p><strong className="product-price">{formatMoney(product.priceKurus)}</strong><div className="seller-box"><div className="seller-avatar">{product.seller.charAt(0)}</div><div><b>{product.seller}</b><span>★ {product.rating.toFixed(1)} · Doğrulanmış işlemler</span></div><em>{product.verified ? "✓ Doğrulanmış" : "Standart satıcı"}</em></div><ProductActions productId={product.id} sellerId={product.sellerId} legalDocuments={legalDocuments}/><div className="protection-note"><i>⌁</i><div><b>OrtakPazar alıcı koruması</b><p>Kart bilgileri platformda tutulmaz. Satıcı ödemesi teslimat, onay ve uyuşmazlık koşullarına göre başlatılır.</p></div></div></div></div><div className="product-info-grid"><section><h2>Ürün açıklaması</h2><p>{product.description}</p></section><section><h2>Kargo ve güvence</h2><ul><li>Takip numarası zorunludur</li><li>Teslimat sonrası onay süresi bulunur</li><li>Uyuşmazlık açıkken payout yapılmaz</li><li>İlan fiyatı siparişte snapshot olarak saklanır</li></ul></section></div></div>;
}
