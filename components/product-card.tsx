import Link from "next/link";
import { conditionLabel, formatMoney, type CatalogProduct } from "@/lib/demo";

export function ProductCard({ product }: { product: CatalogProduct }) {
  return <article className="market-card"><Link prefetch={false} href={`/urun/${product.slug}`} className="card-image"><img src={product.image} alt={product.title}/><span>{conditionLabel[product.condition]}</span></Link><div className="card-body"><small>{product.location} · {product.category}</small><Link prefetch={false} href={`/urun/${product.slug}`}><h3>{product.title}</h3></Link><b>{formatMoney(product.priceKurus)}</b><div className="seller-line"><span>{product.seller}</span><span>{product.verified ? "✓ Doğrulanmış" : `★ ${product.rating}`}</span></div></div></article>;
}
