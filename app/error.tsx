"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="narrow-page"><span className="kicker dark">İŞLEM TAMAMLANAMADI</span><h1>Sayfayı açarken bir sorun oluştu</h1><p>Bilgileriniz korunuyor. İşlemi yeniden deneyebilir veya ana sayfaya dönebilirsiniz.</p><div className="error-actions"><button className="button primary" onClick={reset}>Tekrar dene</button><Link prefetch={false} className="button outline" href="/">Ana sayfa</Link></div></div>;
}
