import { ProductCard } from "@/components/product-card";
import { requireUser } from "@/lib/auth";
import { listCatalogProducts } from "@/lib/marketplace/products";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function FavoritesPage() { const user = await requireUser("/favoriler"); const [{ data: favorites }, products] = await Promise.all([createSupabaseAdminClient().from("favorites").select("product_id").eq("user_id", user.id), listCatalogProducts()]); const ids = new Set((favorites ?? []).map((item) => item.product_id)); const selected = products.filter((product) => ids.has(product.id)); return <div className="dashboard-page"><div className="page-heading"><span className="kicker dark">KAYDETTİKLERİN</span><h1>Favoriler</h1></div>{selected.length ? <div className="market-grid four">{selected.map((product) => <ProductCard key={product.id} product={product}/>)}</div> : <div className="empty-state"><h2>Henüz favorin yok</h2><p>Beğendiğin ilanları kalp simgesiyle burada toplayabilirsin.</p></div>}</div>; }
