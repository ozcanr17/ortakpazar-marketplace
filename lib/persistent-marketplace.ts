import type { AppUser } from "@/lib/auth";
import { database, ensureDatabase, uploads } from "@/lib/database";
import type { CatalogProduct } from "@/lib/demo";
import { createStoragePath, validateImage } from "@/lib/security/upload";

interface ProductRow { id: string; seller_id: string; title: string; slug: string; description: string; category: string; category_slug: string; condition: CatalogProduct["condition"]; price_kurus: number; location: string; image_key: string | null; first_name: string; last_name: string }

const mapProduct = (row: ProductRow): CatalogProduct & { sellerId: string } => ({
  id: row.id,
  sellerId: row.seller_id,
  title: row.title,
  slug: row.slug,
  description: row.description,
  category: row.category,
  categorySlug: row.category_slug,
  condition: row.condition,
  priceKurus: row.price_kurus,
  location: row.location,
  image: row.image_key ? `/api/uploads/${encodeURIComponent(row.image_key)}` : "/globe.svg",
  seller: `${row.first_name} ${row.last_name}`,
  rating: 5,
  verified: false,
});

const selectProducts = `SELECT p.id,p.seller_id,p.title,p.slug,p.description,p.condition,p.price_kurus,p.location,p.image_key,c.name AS category,c.slug AS category_slug,u.first_name,u.last_name FROM products p JOIN categories c ON c.id = p.category_id JOIN users u ON u.id = p.seller_id`;

export async function listPersistentProducts(filters: { query?: string; category?: string; condition?: string } = {}): Promise<Array<CatalogProduct & { sellerId: string }>> {
  await ensureDatabase();
  const clauses = ["p.status = 'ACTIVE'"];
  const values: Array<string> = [];
  if (filters.query) { clauses.push("(p.title LIKE ? OR p.description LIKE ?)"); values.push(`%${filters.query}%`, `%${filters.query}%`); }
  if (filters.category) { clauses.push("c.slug = ?"); values.push(filters.category); }
  if (filters.condition) { clauses.push("p.condition = ?"); values.push(filters.condition); }
  const result = await database().prepare(`${selectProducts} WHERE ${clauses.join(" AND ")} ORDER BY p.created_at DESC LIMIT 100`).bind(...values).all<ProductRow>();
  return result.results.map(mapProduct);
}

export async function getPersistentProduct(slug: string): Promise<(CatalogProduct & { sellerId: string }) | null> {
  await ensureDatabase();
  const row = await database().prepare(`${selectProducts} WHERE p.slug = ? AND p.status = 'ACTIVE' LIMIT 1`).bind(slug).first<ProductRow>();
  return row ? mapProduct(row) : null;
}

export async function listCategories(): Promise<Array<{ id: string; name: string }>> {
  await ensureDatabase();
  return (await database().prepare("SELECT id,name FROM categories WHERE active = 1 ORDER BY name").all<{ id: string; name: string }>()).results;
}

const slugify = (value: string) => value.toLocaleLowerCase("tr-TR").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 120);

export async function createPersistentProduct(user: AppUser, input: { title: string; description: string; categoryId: string; condition: CatalogProduct["condition"]; priceKurus: number; location: string }, files: File[]): Promise<string> {
  await ensureDatabase();
  if (files.length < 1 || files.length > 8) throw new Error("1–8 fotoğraf yüklemelisiniz");
  const validated = await Promise.all(files.map(validateImage));
  const keys = validated.map((item) => createStoragePath(user.id, item.extension));
  for (let index = 0; index < validated.length; index += 1) await uploads().put(keys[index], validated[index].bytes, { httpMetadata: { contentType: files[index].type } });
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const slug = `${slugify(input.title)}-${id.slice(0, 8)}`;
  try {
    await database().prepare("INSERT INTO products (id,seller_id,title,slug,description,category_id,condition,price_kurus,status,location,image_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'PENDING_REVIEW',?,?,?,?)")
      .bind(id, user.id, input.title, slug, input.description, input.categoryId, input.condition, input.priceKurus, input.location, keys[0], now, now).run();
    return id;
  } catch (error) {
    await Promise.all(keys.map((key) => uploads().delete(key)));
    throw error;
  }
}

export async function togglePersistentFavorite(userId: string, productId: string): Promise<boolean> {
  await ensureDatabase();
  const existing = await database().prepare("SELECT 1 AS found FROM favorites WHERE user_id = ? AND product_id = ?").bind(userId, productId).first();
  if (existing) { await database().prepare("DELETE FROM favorites WHERE user_id = ? AND product_id = ?").bind(userId, productId).run(); return false; }
  await database().prepare("INSERT INTO favorites (user_id,product_id,created_at) VALUES (?,?,?)").bind(userId, productId, new Date().toISOString()).run();
  return true;
}

export async function listFavoriteProducts(userId: string): Promise<Array<CatalogProduct & { sellerId: string }>> {
  await ensureDatabase();
  const result = await database().prepare(`${selectProducts} JOIN favorites f ON f.product_id = p.id WHERE f.user_id = ? AND p.status = 'ACTIVE' ORDER BY f.created_at DESC`).bind(userId).all<ProductRow>();
  return result.results.map(mapProduct);
}
