import { ProductCard } from "@/components/product-card";
import { requireUser } from "@/lib/auth";
import { listFavoriteProducts } from "@/lib/persistent-marketplace";

export const dynamic = "force-dynamic";
export default async function FavoritesPage() { const user = await requireUser("/favoriler"); const selected = await listFavoriteProducts(user.id); return <div className="dashboard-page"><div className="page-heading"><span className="kicker dark">KAYDETTİKLERİN</span><h1>Favoriler</h1></div>{selected.length ? <div className="market-grid four">{selected.map((product) => <ProductCard key={product.id} product={product}/>)}</div> : <div className="empty-state"><h2>Henüz favorin yok</h2><p>Beğendiğin ilanları kalp simgesiyle burada toplayabilirsin.</p></div>}</div>; }
