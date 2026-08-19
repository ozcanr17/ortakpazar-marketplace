import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductActions } from "@/components/product-actions";
import { conditionLabel, demoProducts, formatMoney, type CatalogProduct } from "@/lib/demo";
import { getProductBySlug } from "@/lib/marketplace/products";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

async function loadProduct(slug: string): Promise<CatalogProduct & { sellerId: string }> {
  const demo = demoProducts.find((product) => product.slug === slug);
  if (demo) return { ...demo, sellerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
  const row = await getProductBySlug(slug).catch(() => null);
  if (!row) notFound();
  const category = Array.isArray(row.category) ? row.category[0] : row.category;
  const seller = Array.isArray(row.seller) ? row.seller[0] : row.seller;
  const verification = Array.isArray(row.verification) ? row.verification[0] : row.verification;
  const images = [...(row.images ?? [])].sort((left, right) => left.sort_order - right.sort_order);
  const base = getPublicEnv().NEXT_PUBLIC_SUPABASE_URL;
  return { id: row.id, sellerId: row.seller_id, title: row.title, slug: row.slug, category: category?.name ?? "Diğer", categorySlug: category?.slug ?? "diger", condition: row.condition, priceKurus: row.price_kurus, location: row.location, image: images[0] ? `${base}/storage/v1/object/public/product-images/${images[0].storage_path}` : "/globe.svg", seller: seller?.display_name ?? "OrtakPazar üyesi", rating: (seller?.rating_basis_points ?? 0) / 100, verified: verification?.status === "VERIFIED", description: row.description };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const product = await loadProduct(slug).catch(() => null);
  if (!product) return { title: "İlan bulunamadı", description: "İlan artık yayında değil.", openGraph: { images: [] }, twitter: { images: [] } };
  return { title: product.title, description: product.description.slice(0, 150), openGraph: { title: product.title, description: product.description.slice(0, 150), images: [{ url: product.image }] }, twitter: { title: product.title, description: product.description.slice(0, 150), images: [product.image] } };
}

async function getCheckoutDocuments() { try { const { data } = await createSupabaseAdminClient().from("legal_documents").select("id,title,type").in("type", ["DISTANCE_SALES_INFORMATION", "DISTANCE_SALES_AGREEMENT_TEMPLATE"]).eq("active", true); return data ?? []; } catch { return []; } }

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const product = await loadProduct(slug);
  const legalDocuments = await getCheckoutDocuments();
  return <div className="product-page"><div className="breadcrumbs">Ana sayfa / {product.category} / {product.title}</div><div className="product-layout"><div className="product-gallery"><div className="main-image"><img src={product.image} alt={product.title}/>{product.verified && <span className="verified-badge">✓ Fiziksel ürün doğrulandı</span>}</div><div className="thumbnail-row"><button><img src={product.image} alt="Ürün fotoğrafı 1"/></button></div></div><div className="product-detail"><span className="condition-pill">{conditionLabel[product.condition]}</span><h1>{product.title}</h1><p className="product-location">{product.location} · Bugün güncellendi</p><strong className="product-price">{formatMoney(product.priceKurus)}</strong><div className="seller-box"><div className="seller-avatar">{product.seller.charAt(0)}</div><div><b>{product.seller}</b><span>★ {product.rating.toFixed(1)} · Doğrulanmış işlemler</span></div><em>{product.verified ? "✓ Doğrulanmış" : "Standart satıcı"}</em></div><ProductActions productId={product.id} sellerId={product.sellerId} legalDocuments={legalDocuments}/><div className="protection-note"><i>⌁</i><div><b>OrtakPazar alıcı koruması</b><p>Kart bilgileri platformda tutulmaz. Satıcı ödemesi teslimat, onay ve uyuşmazlık koşullarına göre başlatılır.</p></div></div></div></div><div className="product-info-grid"><section><h2>Ürün açıklaması</h2><p>{product.description}</p></section><section><h2>Kargo ve güvence</h2><ul><li>Takip numarası zorunludur</li><li>Teslimat sonrası onay süresi bulunur</li><li>Uyuşmazlık açıkken payout yapılmaz</li><li>İlan fiyatı siparişte snapshot olarak saklanır</li></ul></section></div></div>;
}
