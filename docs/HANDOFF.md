# OrtakPazar Devir Teslim Notu

## Resmi kaynak

Kaynak kodun güncel ve tek resmi kopyası GitHub deposudur:

https://github.com/ozcanr17/ortakpazar-marketplace

Eski `nova-outlet-tr.astgm67.chatgpt.site` adresi önceki barındırma ortamına aittir ve teslim sonrası referans olarak kullanılmamalıdır. Yeni yayın, bu repository'den arkadaşınızın kendi Cloudflare hesabında yapılmalıdır.

## Hızlı başlangıç

```bash
git clone https://github.com/ozcanr17/ortakpazar-marketplace.git
cd ortakpazar-marketplace
npm install
cp .env.example .env
npm run dev
```

Uygulama `http://localhost:3000` adresinde çalışır. Node.js `22.13.0` veya daha yeni bir sürüm gerekir.

## Yerel demo hesapları

`.env` dosyasına yalnızca yerel geliştirme için aşağıdaki değerler girilebilir:

```env
INITIAL_ADMIN_EMAIL=admin
INITIAL_ADMIN_PASSWORD=admin123
TEST_USER_EMAIL=test@test.com
TEST_USER_PASSWORD=test12345A
```

Bu değerler demo içindir. Production'da güçlü, benzersiz şifreler kullanılmalı; `.env` dosyası hiçbir zaman Git'e eklenmemelidir.

## Kontrol listesi

```bash
npm run verify
```

Bu komut typecheck, lint, test ve production build aşamalarını çalıştırır.

## Production yayını

Cloudflare D1 ve R2 ile yayın için ayrıntılı adımlar [DEPLOYMENT.md](DEPLOYMENT.md) dosyasındadır.

Gerçek ödeme kapalıdır. `MockEscrowPaymentProvider` yalnızca demo amaçlıdır. Lisanslı ödeme kuruluşu entegrasyonu ve hukuki doğrulamalar tamamlanmadan gerçek para akışı etkinleştirilmemelidir.
