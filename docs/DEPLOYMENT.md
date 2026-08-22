# Cloudflare Deployment Rehberi

## 1. Cloudflare kaynaklarını oluşturun

Cloudflare hesabında bir D1 veritabanı ve bir R2 bucket oluşturun:

```bash
npx wrangler login
npx wrangler d1 create ortakpazar-db
npx wrangler r2 bucket create ortakpazar-uploads
```

İlk komutun çıktısındaki D1 `database_id` değerini saklayın.

## 2. Deployment yapılandırmasını ekleyin

Repository kökünde `wrangler.jsonc` oluşturun. `database_id` alanına kendi D1 kimliğinizi yazın:

```jsonc
{
  "name": "ortakpazar-marketplace",
  "main": "./dist/server/index.js",
  "compatibility_date": "2026-05-15",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "directory": "./dist/client" },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "ortakpazar-db",
      "database_id": "D1_DATABASE_ID"
    }
  ],
  "r2_buckets": [
    {
      "binding": "UPLOADS",
      "bucket_name": "ortakpazar-uploads"
    }
  ]
}
```

`D1_DATABASE_ID` gerçek bir değer değildir; Cloudflare'ın `d1 create` çıktısındaki kimlik ile değiştirilmelidir. Bu dosya kişiye özel kaynak kimliği içerdiği için istenirse `.gitignore` içine eklenebilir.

## 3. Production secret'larını tanımlayın

```bash
npx wrangler secret put INITIAL_ADMIN_EMAIL
npx wrangler secret put INITIAL_ADMIN_PASSWORD
npx wrangler secret put TEST_USER_EMAIL
npx wrangler secret put TEST_USER_PASSWORD
```

Test hesabını production'da oluşturmamak için son iki değişkeni boş bırakın. Yönetici hesabı için üretimde benzersiz ve güçlü bir şifre kullanın.

## 4. Derleyin ve yayınlayın

```bash
npm install
npm run verify
npx wrangler deploy
```

İlk istek sırasında uygulama D1 şemasını ve idempotent demo verilerini oluşturur. Cloudflare tarafından verilen `workers.dev` adresini kontrol edin; sonra özel domain bağlayın.

## 5. Production sonrası kontroller

- Kayıt, giriş, ilan oluşturma ve admin onay akışını kontrol edin.
- R2 yüklemelerinin çalıştığını doğrulayın.
- Admin şifresini saklanan secret üzerinden değiştirin.
- Test hesabını kaldırın veya devre dışı bırakın.
- Gerçek ödeme sağlayıcısı olmadan ödeme akışını demo modunda bırakın.
- Hukuki belgeleri ve Türkiye uyum gereksinimlerini uzmanlarla gözden geçirin.

## D1 ve R2 kaynakları hakkında not

Uygulama `DB` adlı D1 binding'ini ve `UPLOADS` adlı R2 binding'ini bekler. Bu isimler kod içinde kullanılan sözleşmedir; deployment yapılandırmasında değiştirilmemelidir.
