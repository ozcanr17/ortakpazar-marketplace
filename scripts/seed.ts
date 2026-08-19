import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const required = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`${name} gerekli`); return value; };
const client = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });

async function ensureUser(email: string, password: string, role: "USER" | "ADMIN", firstName: string, lastName: string) {
  const normalized = email.toLowerCase();
  const { data: existing } = await client.from("users").select("id,auth_user_id").eq("email", normalized).maybeSingle();
  if (existing) return existing.id;
  const { data: listed } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let authUser = listed.users.find((user) => user.email?.toLowerCase() === normalized);
  if (!authUser) {
    const { data, error } = await client.auth.admin.createUser({ email: normalized, password, email_confirm: true });
    if (error || !data.user) throw new Error(`Kullanıcı oluşturulamadı: ${normalized}`);
    authUser = data.user;
  }
  const id = crypto.randomUUID();
  const { error: userError } = await client.from("users").insert({ id, auth_user_id: authUser.id, email: normalized, role, email_verified_at: new Date().toISOString() });
  if (userError) throw userError;
  const { error: profileError } = await client.from("profiles").insert({ user_id: id, first_name: firstName, last_name: lastName });
  if (profileError) throw profileError;
  return id;
}

async function seedLegal() {
  const files = [
    ["USER_AGREEMENT", "Kullanıcı Sözleşmesi", "user-agreement.txt"],
    ["KVKK_NOTICE", "KVKK Aydınlatma Metni", "kvkk-notice.txt"],
    ["DISTANCE_SALES_INFORMATION", "Mesafeli Satış Ön Bilgilendirme", "distance-sales-info.txt"],
    ["DISTANCE_SALES_AGREEMENT_TEMPLATE", "Mesafeli Satış Sözleşmesi Şablonu", "distance-sales-template.txt"],
  ] as const;
  for (const [type, title, file] of files) {
    const content = await readFile(resolve("seed/legal", file), "utf8");
    const { data } = await client.from("legal_documents").select("id").eq("type", type).eq("version", "dev-1.0").maybeSingle();
    if (!data) await client.from("legal_documents").insert({ type, version: "dev-1.0", title, content, active: true, published_at: new Date().toISOString(), requires_legal_review: true });
  }
}

const categories = [["Elektronik", "elektronik"], ["Ev & Yaşam", "ev-yasam"], ["Moda", "moda"], ["Spor", "spor"], ["Koleksiyon", "koleksiyon"], ["Anne & Bebek", "anne-bebek"]] as const;
const compliance = [
  ["law-6563", "6563 Elektronik Ticaret mevzuatı"], ["intermediary-obligations", "Elektronik ticaret aracı hizmet sağlayıcı yükümlülükleri"], ["etbis", "ETBİS değerlendirmesi ve kayıt durumu"], ["law-6502", "6502 Tüketicinin Korunması"], ["distance-sales", "Mesafeli Sözleşmeler Yönetmeliği"], ["kvkk", "KVKK"], ["cookies", "Çerez yönetimi"], ["commercial-messages", "Ticari elektronik ileti izinleri"], ["iys", "İYS değerlendirmesi"], ["tax-invoice", "Vergi ve fatura süreçleri"], ["seller-status", "Satıcının bireysel veya ticari statüsü"], ["prohibited-products", "Yasaklı ürün politikası"], ["content-removal", "İçerik ve ilan kaldırma süreçleri"], ["payment-provider", "Ödeme kuruluşu sözleşmesi"], ["payout", "Payout süreçleri"], ["returns", "İade ve cayma süreçleri"], ["retention", "Saklama süreleri"], ["breach", "Veri ihlali prosedürü"], ["user-requests", "Kullanıcı başvuru sistemi"], ["legal-counsel", "Hukuk danışmanı onayı"],
] as const;

async function seedCatalog(sellerId: string, supabase: SupabaseClient) {
  await supabase.from("seller_profiles").upsert({ user_id: sellerId, display_name: "Demo Satıcı", seller_type: "INDIVIDUAL", payout_account_reference: `mock:${sellerId}`, verification_status: "VERIFIED" });
  const { data: category } = await supabase.from("categories").select("id").eq("slug", "elektronik").single();
  if (!category) return;
  const products = [
    { id: "11111111-1111-4111-8111-111111111111", title: "Sony WH-1000XM5 Kulaklık", slug: "sony-wh-1000xm5-kulaklik", price: 899900, condition: "LIKE_NEW" },
    { id: "55555555-5555-4555-8555-555555555555", title: "Mekanik Klavye", slug: "mekanik-klavye", price: 175000, condition: "GOOD" },
  ];
  for (const product of products) await supabase.from("products").upsert({ id: product.id, seller_id: sellerId, title: product.title, slug: product.slug, description: `${product.title} demo ilanı. Ürün kondisyonu ve tüm özellikleri alıcıya şeffaf şekilde sunulur.`, category_id: category.id, condition: product.condition, price_kurus: product.price, status: "ACTIVE", location: "İstanbul", published_at: new Date().toISOString() });
}

async function main() {
  const adminId = await ensureUser(required("INITIAL_ADMIN_EMAIL"), required("INITIAL_ADMIN_PASSWORD"), "ADMIN", "Platform", "Yöneticisi");
  await client.from("platform_settings").upsert({ id: 1, commission_type: "PERCENTAGE", percentage_basis_points: 500, fixed_fee_kurus: 0, minimum_fee_kurus: 0, updated_by: adminId });
  for (const [name, slug] of categories) await client.from("categories").upsert({ name, slug }, { onConflict: "slug" });
  for (const [key, title] of compliance) await client.from("compliance_items").upsert({ key, title }, { onConflict: "key" });
  await seedLegal();
  const sellerEmail = process.env.DEMO_SELLER_EMAIL; const sellerPassword = process.env.DEMO_SELLER_PASSWORD; const buyerEmail = process.env.DEMO_BUYER_EMAIL; const buyerPassword = process.env.DEMO_BUYER_PASSWORD;
  if (sellerEmail && sellerPassword && buyerEmail && buyerPassword) {
    const sellerId = await ensureUser(sellerEmail, sellerPassword, "USER", "Demo", "Satıcı");
    const buyerId = await ensureUser(buyerEmail, buyerPassword, "USER", "Demo", "Alıcı");
    await seedCatalog(sellerId, client);
    const { data: existingOrder } = await client.from("orders").select("id").eq("product_id", "11111111-1111-4111-8111-111111111111").maybeSingle();
    if (!existingOrder) await client.from("orders").insert({ buyer_id: buyerId, seller_id: sellerId, product_id: "11111111-1111-4111-8111-111111111111", product_title: "Sony WH-1000XM5 Kulaklık", product_price_kurus: 899900, commission_type: "PERCENTAGE", commission_percentage_basis_points: 500, commission_fixed_fee_kurus: 0, platform_fee_kurus: 44995, seller_net_amount_kurus: 854905, payment_status: "HELD", order_status: "SELLER_PREPARING", shipping_status: "PREPARING", seller_ship_by: new Date(Date.now() + 72 * 3600000).toISOString() });
  }
}

await main();
