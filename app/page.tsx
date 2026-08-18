"use client";

import { useMemo, useState } from "react";

type Product = { id: number; name: string; category: string; price: number; oldPrice: number; image: string; badge?: string };

const categories = [
  { name: "Elektronik", icon: "⌁" }, { name: "Ev & Yaşam", icon: "⌂" },
  { name: "El Aletleri", icon: "⚒" }, { name: "Ofis", icon: "▤" }, { name: "Aksesuar", icon: "◇" },
];

const products: Product[] = [
  { id: 1, name: "Kablosuz Bluetooth Kulaklık", category: "Elektronik", price: 749, oldPrice: 1199, badge: "Çok Satan", image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85" },
  { id: 2, name: "Minimal Masa Lambası", category: "Ev & Yaşam", price: 589, oldPrice: 849, badge: "Yeni", image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85" },
  { id: 3, name: "Profesyonel Matkap Seti", category: "El Aletleri", price: 1799, oldPrice: 2499, badge: "%28 İndirim", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=85" },
  { id: 4, name: "Ergonomik Çalışma Koltuğu", category: "Ofis", price: 3249, oldPrice: 4299, badge: "Sınırlı Stok", image: "https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?auto=format&fit=crop&w=900&q=85" },
  { id: 5, name: "Akıllı Spor Saati", category: "Elektronik", price: 1399, oldPrice: 1999, image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85" },
  { id: 6, name: "Deri Günlük Sırt Çantası", category: "Aksesuar", price: 949, oldPrice: 1299, image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=85" },
  { id: 7, name: "Seramik Kahve Seti", category: "Ev & Yaşam", price: 499, oldPrice: 699, badge: "Yeni", image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=85" },
  { id: 8, name: "Mekanik Klavye", category: "Elektronik", price: 1649, oldPrice: 2199, image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=85" },
];

const formatPrice = (value: number) => new Intl.NumberFormat("tr-TR").format(value) + " TL";

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("Tümü");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Product[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => products.filter((p) => (activeCategory === "Tümü" || p.category === activeCategory) && p.name.toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR"))), [activeCategory, search]);
  const cartTotal = cart.reduce((total, item) => total + item.price, 0);
  const scrollToProducts = () => document.getElementById("urunler")?.scrollIntoView({ behavior: "smooth" });
  function addToCart(product: Product) { setCart((current) => [...current, product]); setNotice(`${product.name} sepete eklendi`); window.setTimeout(() => setNotice(""), 2200); }

  return <main>
    <div className="announcement">2.000 TL üzeri siparişlerde ücretsiz kargo <span>•</span> 14 gün kolay iade</div>
    <header className="header">
      <a className="logo" href="#" aria-label="NOVA ana sayfa"><span>N</span>NOVA<small>OUTLET</small></a>
      <nav className={menuOpen ? "nav open" : "nav"} aria-label="Ana menü"><a href="#urunler" onClick={() => setMenuOpen(false)}>Ürünler</a><a href="#kategoriler" onClick={() => setMenuOpen(false)}>Kategoriler</a><a href="#neden-biz" onClick={() => setMenuOpen(false)}>Neden Biz?</a><a href="#iletisim" onClick={() => setMenuOpen(false)}>İletişim</a></nav>
      <div className="header-actions"><button className="search-toggle" onClick={scrollToProducts} aria-label="Ürün ara">⌕</button><button className="cart-button" onClick={() => setCartOpen(true)} aria-label={`Sepet, ${cart.length} ürün`}>Sepet <span>{cart.length}</span></button><button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menüyü aç">{menuOpen ? "×" : "☰"}</button></div>
    </header>
    <section className="hero"><div className="hero-copy"><p className="eyebrow">SEÇİLİ ÜRÜNLERDE SEZON FIRSATI</p><h1>İyi ürünler.<br/><em>Daha iyi fiyatlar.</em></h1><p className="hero-text">Günlük yaşamı kolaylaştıran kaliteli ürünleri, stoklarla sınırlı özel fiyatlarla keşfedin.</p><div className="hero-actions"><button className="primary" onClick={scrollToProducts}>Fırsatları keşfet <span>→</span></button><a href="#neden-biz">Nasıl çalışır?</a></div><div className="hero-proof"><b>4.9</b> ★★★★★ <span>2.400+ mutlu müşteri</span></div></div><div className="hero-visual"><img src="https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=1400&q=88" alt="Modern elektronik ürün seçkisi"/><div className="deal-card"><span>Haftanın fırsatı</span><b>%40&apos;a varan</b><small>indirimler</small></div><div className="stock-pill"><i/> Stoktan hızlı teslimat</div></div></section>
    <section className="benefit-bar" aria-label="Alışveriş avantajları"><div><span>▱</span><p><b>Hızlı teslimat</b><small>1–3 iş günü içinde</small></p></div><div><span>↶</span><p><b>Kolay iade</b><small>14 gün içinde ücretsiz</small></p></div><div><span>✓</span><p><b>Güvenli ödeme</b><small>256-bit SSL koruması</small></p></div><div><span>✦</span><p><b>Özenle seçildi</b><small>Kalite kontrol onaylı</small></p></div></section>
    <section className="categories section" id="kategoriler"><div className="section-heading"><div><p className="eyebrow dark">KATEGORİLER</p><h2>Aradığını kolayca bul</h2></div><button onClick={() => { setActiveCategory("Tümü"); scrollToProducts(); }}>Tüm ürünler →</button></div><div className="category-grid">{categories.map((c) => <button key={c.name} onClick={() => { setActiveCategory(c.name); scrollToProducts(); }}><span>{c.icon}</span><b>{c.name}</b><small>Ürünleri gör →</small></button>)}</div></section>
    <section className="products section" id="urunler"><div className="section-heading products-heading"><div><p className="eyebrow dark">ÖNE ÇIKANLAR</p><h2>Kaçırılmayacak fırsatlar</h2></div><label className="search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ürün ara..." aria-label="Ürün ara"/></label></div><div className="filter-row">{["Tümü", ...categories.map((c) => c.name)].map((category) => <button className={activeCategory === category ? "active" : ""} onClick={() => setActiveCategory(category)} key={category}>{category}</button>)}</div><div className="product-grid">{filtered.map((p) => <article className="product-card" key={p.id}><div className="product-image"><img src={p.image} alt={p.name}/>{p.badge && <span className="badge">{p.badge}</span>}<button aria-label={`${p.name} favorilere ekle`}>♡</button></div><div className="product-info"><small>{p.category}</small><h3>{p.name}</h3><div className="rating">★★★★★ <span>(24)</span></div><div className="price-row"><p><b>{formatPrice(p.price)}</b><del>{formatPrice(p.oldPrice)}</del></p><button onClick={() => addToCart(p)} aria-label={`${p.name} sepete ekle`}>+</button></div></div></article>)}</div>{filtered.length === 0 && <div className="empty">Aramana uygun ürün bulunamadı. Başka bir kelime deneyebilirsin.</div>}</section>
    <section className="story section" id="neden-biz"><div className="story-image"><img src="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&q=85" alt="NOVA Outlet paketleri"/><div><b>10.000+</b><span>Başarılı teslimat</span></div></div><div className="story-copy"><p className="eyebrow dark">NEDEN NOVA?</p><h2>Kaliteli alışverişin<br/>daha akıllı yolu.</h2><p>Fazla stok ve sezon sonu ürünlerini doğrudan tedarikçilerden seçiyor, kalite kontrolünden geçiriyor ve avantajlı fiyatlarla sunuyoruz.</p><ul><li><span>✓</span><div><b>Kontrol edilmiş ürünler</b><small>Her ürün satıştan önce ekibimizce incelenir.</small></div></li><li><span>✓</span><div><b>Şeffaf fiyatlandırma</b><small>Gizli ücret yok, gördüğünüz fiyat geçerli.</small></div></li><li><span>✓</span><div><b>Daha az israf</b><small>İyi ürünlere ikinci bir şans veriyoruz.</small></div></li></ul><button className="secondary" onClick={scrollToProducts}>Alışverişe başla →</button></div></section>
    <section className="newsletter section" id="iletisim"><div><p className="eyebrow">FIRSATLARI KAÇIRMA</p><h2>Yeni ürünlerden ilk sen haberdar ol.</h2></div><form onSubmit={(e) => { e.preventDefault(); setNotice("Teşekkürler! E-posta listesine katıldınız."); }}><input type="email" required placeholder="E-posta adresin" aria-label="E-posta adresi"/><button type="submit">Kaydol →</button></form></section>
    <footer><a className="logo light" href="#"><span>N</span>NOVA<small>OUTLET</small></a><p>Kaliteli ürünler, akıllı fiyatlar.</p><div><a href="#urunler">Ürünler</a><a href="#neden-biz">Hakkımızda</a><a href="#iletisim">Destek</a><a href="#">Gizlilik</a></div><small>© 2026 NOVA Outlet. Tüm hakları saklıdır.</small></footer>
    {notice && <div className="toast" role="status">✓ {notice}</div>}
    {cartOpen && <div className="cart-overlay" onClick={() => setCartOpen(false)}><aside className="cart-drawer" onClick={(e) => e.stopPropagation()} aria-label="Alışveriş sepeti"><div className="cart-title"><h2>Sepetin <span>({cart.length})</span></h2><button onClick={() => setCartOpen(false)}>×</button></div>{cart.length === 0 ? <div className="empty-cart"><span>▱</span><h3>Sepetin henüz boş</h3><p>Fırsat ürünlerini keşfetmeye ne dersin?</p><button onClick={() => { setCartOpen(false); scrollToProducts(); }}>Alışverişe başla</button></div> : <><div className="cart-items">{cart.map((item, index) => <div className="cart-item" key={`${item.id}-${index}`}><img src={item.image} alt=""/><div><small>{item.category}</small><b>{item.name}</b><span>{formatPrice(item.price)}</span></div><button onClick={() => setCart((current) => current.filter((_, i) => i !== index))} aria-label="Ürünü sepetten çıkar">×</button></div>)}</div><div className="cart-summary"><p><span>Ara toplam</span><b>{formatPrice(cartTotal)}</b></p><small>Kargo, teslimat adresinde hesaplanır.</small><button onClick={() => setNotice("Ödeme altyapısı mağaza bilgilerinizle bağlanacak.")}>Ödemeye geç →</button></div></>}</aside></div>}
  </main>;
}
