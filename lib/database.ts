import { env } from "cloudflare:workers";
import { schemaStatements } from "@/db/schema";

type Bindings = { DB: D1Database; UPLOADS: R2Bucket; INITIAL_ADMIN_EMAIL?: string; INITIAL_ADMIN_PASSWORD?: string };

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
  await db.prepare("PRAGMA optimize").run();
}
