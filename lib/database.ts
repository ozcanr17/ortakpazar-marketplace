import { env } from "cloudflare:workers";
import { schemaStatements } from "@/db/schema";
import { hashPassword } from "@/lib/password";

type Bindings = { DB: D1Database; UPLOADS: R2Bucket; INITIAL_ADMIN_EMAIL?: string; INITIAL_ADMIN_PASSWORD?: string; TEST_USER_EMAIL?: string; TEST_USER_PASSWORD?: string };

const bindings = () => env as unknown as Bindings;

let initialized: Promise<void> | null = null;

export function database(): D1Database {
  return bindings().DB;
}

export function uploads(): R2Bucket {
  return bindings().UPLOADS;
}

export function initialAdminCredentials(): { email: string; password: string } | null {
  const email = bindings().INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = bindings().INITIAL_ADMIN_PASSWORD;
  return email && password ? { email, password } : null;
}

export function testUserCredentials(): { email: string; password: string } | null {
  const email = bindings().TEST_USER_EMAIL?.trim().toLowerCase();
  const password = bindings().TEST_USER_PASSWORD;
  return email && password ? { email, password } : null;
}

export async function ensureDatabase(): Promise<void> {
  initialized ??= (async () => {
    const db = database();
    for (const statement of schemaStatements) await db.prepare(statement).run();
    await seedDatabase(db);
  })().catch((error: unknown) => {
    initialized = null;
    throw error;
  });
  await initialized;
}

async function seedDatabase(db: D1Database): Promise<void> {
  const now = new Date().toISOString();
  const categories = [
    ["c1111111-1111-4111-8111-111111111111", "Elektronik", "elektronik"],
    ["c2222222-2222-4222-8222-222222222222", "Ev & Yaşam", "ev-yasam"],
    ["c3333333-3333-4333-8333-333333333333", "Moda", "moda"],
    ["c4444444-4444-4444-8444-444444444444", "Spor", "spor"],
    ["c5555555-5555-4555-8555-555555555555", "Koleksiyon", "koleksiyon"],
    ["c6666666-6666-4666-8666-666666666666", "Anne & Bebek", "anne-bebek"],
  ];
  await db.batch(categories.map(([id, name, slug]) => db.prepare("INSERT OR IGNORE INTO categories (id,name,slug,active) VALUES (?,?,?,1)").bind(id, name, slug)));
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO legal_documents (id,type,version,title,content,active,published_at) VALUES (?,?,?,?,?,1,?)").bind("d1111111-1111-4111-8111-111111111111", "USER_AGREEMENT", "1.0", "Kullanıcı Sözleşmesi", "OrtakPazar kullanıcı sözleşmesi taslağıdır. Production öncesinde hukuk danışmanı tarafından doğrulanmalıdır.", now),
    db.prepare("INSERT OR IGNORE INTO legal_documents (id,type,version,title,content,active,published_at) VALUES (?,?,?,?,?,1,?)").bind("d2222222-2222-4222-8222-222222222222", "KVKK_NOTICE", "1.0", "KVKK Aydınlatma Metni", "KVKK aydınlatma metni taslağıdır. Production öncesinde hukuk danışmanı tarafından doğrulanmalıdır.", now),
    db.prepare("INSERT OR IGNORE INTO legal_documents (id,type,version,title,content,active,published_at) VALUES (?,?,?,?,?,1,?)").bind("d3333333-3333-4333-8333-333333333333", "DISTANCE_SALES_INFORMATION", "1.0", "Mesafeli Satış Ön Bilgilendirmesi", "Mesafeli satış bilgilendirme taslağıdır. Production öncesinde hukuk danışmanı tarafından doğrulanmalıdır.", now),
    db.prepare("INSERT OR IGNORE INTO legal_documents (id,type,version,title,content,active,published_at) VALUES (?,?,?,?,?,1,?)").bind("d4444444-4444-4444-8444-444444444444", "DISTANCE_SALES_AGREEMENT_TEMPLATE", "1.0", "Mesafeli Satış Sözleşmesi", "Mesafeli satış sözleşmesi taslağıdır. Production öncesinde hukuk danışmanı tarafından doğrulanmalıdır.", now),
    db.prepare("INSERT OR IGNORE INTO legal_documents (id,type,version,title,content,active,published_at) VALUES (?,?,?,?,?,1,?)").bind("d5555555-5555-4555-8555-555555555555", "COOKIE_POLICY", "1.0", "Çerez Politikası", "Zorunlu çerezler oturum ve güvenlik için kullanılır. Analitik ve pazarlama çerezleri kullanıcı izni olmadan etkinleştirilmez. Bu metin production öncesinde hukuk danışmanı tarafından doğrulanmalıdır.", now),
    db.prepare("INSERT OR IGNORE INTO platform_settings (id,commission_type,percentage_basis_points,fixed_fee_kurus,minimum_fee_kurus,maximum_fee_kurus,maintenance_mode,updated_at) VALUES (1,'PERCENTAGE',500,0,0,NULL,0,?)").bind(now),
  ]);
  await seedDemoMarketplace(db, now);
  await seedCompliance(db, now);
  await db.prepare("PRAGMA optimize").run();
}

async function createSeedUser(db: D1Database, input: { id: string; email: string; firstName: string; lastName: string; password?: string }): Promise<void> {
  if (await db.prepare("SELECT id FROM users WHERE id = ? OR email = ? COLLATE NOCASE LIMIT 1").bind(input.id, input.email).first()) return;
  const password = await hashPassword(input.password ?? crypto.randomUUID() + crypto.randomUUID());
  const now = new Date().toISOString();
  await db.prepare("INSERT INTO users (id,email,password_hash,password_salt,first_name,last_name,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,'USER','ACTIVE',?,?)")
    .bind(input.id, input.email, password.hash, password.salt, input.firstName, input.lastName, now, now).run();
}

async function seedDemoMarketplace(db: D1Database, now: string): Promise<void> {
  const sellers = [
    ["a1111111-1111-4111-8111-111111111111", "deniz-demo@ortakpazar.invalid", "Deniz", "Yılmaz", "Deniz'in Dolabı", "INDIVIDUAL", 4.9],
    ["a2222222-2222-4222-8222-222222222222", "kamera-demo@ortakpazar.invalid", "Kamera", "Atölyesi", "Kamera Atölyesi", "BUSINESS", 4.8],
    ["a3333333-3333-4333-8333-333333333333", "toprak-demo@ortakpazar.invalid", "Toprak", "Stüdyo", "Toprak Stüdyo", "BUSINESS", 5],
  ] as const;
  for (const [id, email, firstName, lastName, displayName, sellerType, rating] of sellers) {
    await createSeedUser(db, { id, email, firstName, lastName });
    await db.prepare("INSERT OR IGNORE INTO seller_profiles (user_id,display_name,seller_type,rating,completed_sales,verification_status,created_at,updated_at) VALUES (?,?,?,?,0,'VERIFIED',?,?)")
      .bind(id, displayName, sellerType, rating, now, now).run();
  }
  const test = testUserCredentials();
  if (test) await createSeedUser(db, { id: "a9999999-9999-4999-8999-999999999999", email: test.email, firstName: "Test", lastName: "Kullanıcısı", password: test.password });
  const products = [
    ["11111111-1111-4111-8111-111111111111", sellers[0][0], "Sony WH-1000XM5 Kulaklık", "sony-wh-1000xm5-kulaklik", "Çok az kullanıldı. Kutusu, kablosu ve tüm aksesuarları eksiksizdir. Çalışmasında veya kozmetiğinde sorun yoktur.", "c1111111-1111-4111-8111-111111111111", "LIKE_NEW", 899900, "İstanbul", "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85"],
    ["22222222-2222-4222-8222-222222222222", sellers[1][0], "Fujifilm X-T30 Fotoğraf Makinesi", "fujifilm-x-t30", "Düzenli bakımları yapılmış, sorunsuz çalışan gövdedir. Askı ve iki adet batarya ile gönderilecektir.", "c1111111-1111-4111-8111-111111111111", "GOOD", 2475000, "Ankara", "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=900&q=85"],
    ["33333333-3333-4333-8333-333333333333", sellers[2][0], "El Yapımı Seramik Kahve Seti", "seramik-kahve-seti", "İki kişilik el yapımı seramik kahve seti. Gıdaya uygun sır kullanılmıştır ve her parça benzersizdir.", "c2222222-2222-4222-8222-222222222222", "NEW", 145000, "İzmir", "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=85"],
    ["44444444-4444-4444-8444-444444444444", sellers[0][0], "Retro Deri Sırt Çantası", "retro-deri-sirt-cantasi", "Hakiki deri, az kullanılmış ve temiz durumdadır. 13 inç dizüstü bilgisayar bölmesi bulunur.", "c3333333-3333-4333-8333-333333333333", "LIKE_NEW", 210000, "Bursa", "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=85"],
    ["55555555-5555-4555-8555-555555555555", sellers[1][0], "Mekanik Klavye", "mekanik-klavye", "Brown switch, Türkçe Q tuş dizilimi ve RGB aydınlatmalıdır. Tüm tuşlar test edilmiştir.", "c1111111-1111-4111-8111-111111111111", "GOOD", 175000, "Antalya", "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=85"],
    ["66666666-6666-4666-8666-666666666666", sellers[2][0], "Minimal Masa Lambası", "minimal-masa-lambasi", "Mat metal gövde, ayarlanabilir başlık ve sıcak beyaz LED ampul ile birlikte gelir.", "c2222222-2222-4222-8222-222222222222", "NEW", 89000, "Eskişehir", "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85"],
  ] as const;
  await db.batch(products.map((product) => db.prepare("INSERT OR IGNORE INTO products (id,seller_id,title,slug,description,category_id,condition,price_kurus,status,location,image_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?, 'ACTIVE',?,?,?,?)")
    .bind(product[0], product[1], product[2], product[3], product[4], product[5], product[6], product[7], product[8], product[9], now, now)));
}

async function seedCompliance(db: D1Database, now: string): Promise<void> {
  const titles = ["6563 Elektronik Ticaret mevzuatı", "Elektronik ticaret aracı hizmet sağlayıcı yükümlülükleri", "ETBİS değerlendirmesi ve kayıt durumu", "6502 Tüketicinin Korunması", "Mesafeli Sözleşmeler Yönetmeliği", "KVKK", "Çerez yönetimi", "Ticari elektronik ileti izinleri", "İYS değerlendirmesi", "Vergi ve fatura süreçleri", "Satıcının bireysel/ticari statüsü", "Yasaklı ürün politikası", "İçerik ve ilan kaldırma süreçleri", "Ödeme kuruluşu sözleşmesi", "Payout süreçleri", "İade ve cayma süreçleri", "Saklama süreleri", "Veri ihlali prosedürü", "Kullanıcı başvuru sistemi", "Hukuk danışmanı onayı"];
  await db.batch(titles.map((title, index) => db.prepare("INSERT OR IGNORE INTO compliance_items (id,title,status,updated_at) VALUES (?,?,'NOT_REVIEWED',?)").bind(`compliance-${index + 1}`, title, now)));
}
