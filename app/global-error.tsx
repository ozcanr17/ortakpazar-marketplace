"use client";

import Link from "next/link";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="tr"><body><main className="narrow-page"><h1>Uygulama geçici olarak yanıt veremedi</h1><p>İşlem kaydedilmediyse güvenle yeniden deneyebilirsiniz.</p><div className="error-actions"><button onClick={reset}>Tekrar dene</button><Link prefetch={false} href="/">Ana sayfa</Link></div></main></body></html>;
}
