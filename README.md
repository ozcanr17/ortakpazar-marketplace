# OrtakPazar

Türkiye pazarına yönelik, alıcı ile satıcı arasında güvenli işlem akışı sağlayan C2C/P2P marketplace MVP.

Canlı demo: https://nova-outlet-tr.astgm67.chatgpt.site

## Özellikler

- E-posta ve şifre ile kayıt, giriş, çıkış ve oturum yönetimi
- Fotoğraflı ürün ilanı oluşturma ve yönetici onay süreci
- Arama, kategori ve kondisyon filtreleri
- Favoriler ve ürün/sipariş bağlamında mesajlaşma
- Demo ödeme ve escrow benzeri sipariş durum akışı
- Kargo firması ve takip numarası girişi
- Teslimat onayı, uyuşmazlık ve değerlendirme
- Kullanıcı, mağaza, ürün, sipariş, finans, hukuk ve uyum yönetimi
- Çerez tercihleri ve onay geçmişi
- Audit log, rate limiting, CSRF, XSS ve nesne bazlı yetkilendirme

Gerçek ödeme kapalıdır. `MockEscrowPaymentProvider` yalnızca geliştirme ve sunum amacıyla kullanılır. Lisanslı ödeme kuruluşu entegrasyonu tamamlanmadan gerçek para akışı etkinleştirilmemelidir.

## Teknoloji

- Next.js ve React
- TypeScript strict
- vinext ve Cloudflare Workers
- Cloudflare D1 ve R2
- Zod
- Drizzle ORM/PostgreSQL hazırlığı
- Node.js test runner

## Projeyi klonlama

```bash
git clone https://github.com/ozcanr17/ortakpazar-marketplace.git
cd ortakpazar-marketplace
npm install
cp .env.example .env
npm run dev
```

Uygulama varsayılan olarak `http://localhost:3000` adresinde açılır. Node.js `22.13.0` veya daha yeni bir sürüm kullanın.

## Ortam değişkenleri

`.env.example` dosyasını `.env` olarak kopyalayın ve gerçek değerleri yalnızca yerel veya deployment ortamında tanımlayın.

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
PAYMENT_PROVIDER=mock
INITIAL_ADMIN_EMAIL=
INITIAL_ADMIN_PASSWORD=
TEST_USER_EMAIL=
TEST_USER_PASSWORD=
```

Admin ve test kullanıcısı yalnızca environment variable üzerinden oluşturulur. Gerçek şifreleri repository'ye eklemeyin.

## Kontroller

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Tüm kontrolleri tek komutla çalıştırmak için:

```bash
npm run verify
```

## Veri ve deployment

`.openai/hosting.json`, Cloudflare D1 için `DB` ve R2 için `UPLOADS` binding adlarını tanımlar. Uygulama ilk çalıştırmada şemayı ve demo verilerini idempotent biçimde hazırlar.

Yeni bir production ortamında:

1. D1 veritabanı ve R2 bucket oluşturun.
2. `DB` ve `UPLOADS` bindinglerini deployment ortamına bağlayın.
3. Admin ve test kullanıcı değişkenlerini deployment secret/env ayarlarında tanımlayın.
4. `npm run verify` komutunu çalıştırın.
5. Build çıktısını Cloudflare Workers veya uyumlu vinext altyapısına deploy edin.

Supabase/PostgreSQL seçeneğine geçilecekse `drizzle/`, `supabase/` ve provider katmanları başlangıç noktası olarak kullanılabilir. Ödeme ve kargo sağlayıcısına özel kod iş mantığına yayılmamalıdır.

## Geliştirmeye devam etme

Yeni bir çalışma dalı açın:

```bash
git checkout -b feature/ozellik-adi
```

Değişiklikten sonra kalite kontrollerini çalıştırın:

```bash
npm run verify
git add .
git commit -m "Add feature description"
git push -u origin feature/ozellik-adi
```

Finansal durum geçişlerini yalnızca sunucuda ve transaction-safe biçimde uygulayın. Tutarları kuruş cinsinden integer saklayın; ödeme ve payout işlemlerinde idempotency kullanın. Hukuki metinleri kod içine sabitlemeyin ve production öncesinde hukuk danışmanı onayı alın.

## Dokümantasyon

Müşteri tanıtım dokümanı: [`output/pdf/OrtakPazar-Proje-Tanitim-Dokumani.pdf`](output/pdf/OrtakPazar-Proje-Tanitim-Dokumani.pdf)
