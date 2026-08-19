import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export async function SiteHeader() {
  const user = await getCurrentUser().catch(() => null);
  return <><div className="topbar"><span>Güvenli ödeme akışı</span><span>•</span><span>Teslimat onayından önce satıcı ödemesi yok</span></div><header className="market-header"><Link href="/" className="brand"><i>O</i><b>ORTAK</b><small>PAZAR</small></Link><nav><Link href="/urunler">Keşfet</Link><Link href="/nasil-calisir">Nasıl çalışır?</Link><Link href="/guvenli-alisveris">Güvenli alışveriş</Link><Link href="/yardim">Yardım</Link></nav><div className="market-actions"><Link href="/sat" className="sell-link">+ İlan ver</Link>{user ? <Link href="/profil" className="account-link">Hesabım</Link> : <Link href="/giris" className="account-link">Giriş yap</Link>}</div></header></>;
}
