import { z } from "zod";
import type { AppUser } from "@/lib/auth";
import { AuthorizationError, DomainError } from "@/lib/domain/errors";
import { sanitizeText } from "@/lib/security/text";
import { createStoragePath, validateImage } from "@/lib/security/upload";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { CatalogProduct } from "@/lib/demo";
import { getPublicEnv } from "@/lib/env";

const productSchema = z.object({
  title: z.string().min(5).max(160),
  description: z.string().min(20).max(10000),
  categoryId: z.string().uuid(),
  condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR"]),
  priceKurus: z.number().int().min(100).max(100_000_000),
  location: z.string().min(2).max(120),
});

export type ProductInput = z.input<typeof productSchema>;

const slugify = (value: string) => value.toLocaleLowerCase("tr-TR").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);

export async function createProduct(user: AppUser, input: ProductInput, files: readonly File[]): Promise<{ id: string; slug: string }> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("INVALID_PRODUCT", "İlan bilgileri geçersiz");
  if (files.length < 1 || files.length > 8) throw new DomainError("INVALID_IMAGES", "1 ile 8 arasında ürün fotoğrafı yükleyin");
  const client = createSupabaseAdminClient();
  const { data: category } = await client.from("categories").select("id,active,prohibited").eq("id", parsed.data.categoryId).single();
  if (!category || !category.active || category.prohibited) throw new DomainError("INVALID_CATEGORY", "Bu kategoride ilan oluşturulamaz");
  const id = crypto.randomUUID();
  const slug = `${slugify(parsed.data.title)}-${id.slice(0, 8)}`;
  const uploaded: Array<{ path: string; mime: string; size: number }> = [];
  try {
    for (const file of files) {
      const validated = await validateImage(file);
      const path = createStoragePath(user.id, validated.extension);
      const { error } = await client.storage.from("product-images").upload(path, validated.bytes, { contentType: file.type, upsert: false });
      if (error) throw new DomainError("UPLOAD_FAILED", "Görsel yüklenemedi");
      uploaded.push({ path, mime: file.type, size: file.size });
    }
    const { error: productError } = await client.from("products").insert({ id, seller_id: user.id, title: sanitizeText(parsed.data.title, 160), slug, description: sanitizeText(parsed.data.description, 10000), category_id: parsed.data.categoryId, condition: parsed.data.condition, price_kurus: parsed.data.priceKurus, status: "PENDING_REVIEW", location: sanitizeText(parsed.data.location, 120) });
    if (productError) throw new DomainError("PRODUCT_CREATE_FAILED", "İlan oluşturulamadı");
    const imageRows = uploaded.map((image, index) => ({ product_id: id, storage_path: image.path, mime_type: image.mime, size_bytes: image.size, sort_order: index }));
    const { error: imageError } = await client.from("product_images").insert(imageRows);
    if (imageError) throw new DomainError("PRODUCT_CREATE_FAILED", "İlan görselleri kaydedilemedi");
    return { id, slug };
  } catch (error) {
    if (uploaded.length) await client.storage.from("product-images").remove(uploaded.map((image) => image.path));
    await client.from("products").delete().eq("id", id);
    throw error;
  }
}

export async function toggleFavorite(user: AppUser, productId: string): Promise<boolean> {
  const id = z.string().uuid().parse(productId);
  const client = createSupabaseAdminClient();
  const { data } = await client.from("favorites").select("product_id").eq("user_id", user.id).eq("product_id", id).maybeSingle();
  if (data) { await client.from("favorites").delete().eq("user_id", user.id).eq("product_id", id); return false; }
  const { error } = await client.from("favorites").insert({ user_id: user.id, product_id: id });
  if (error) throw new DomainError("FAVORITE_FAILED", "Favori güncellenemedi");
  return true;
}

export async function assertProductOwner(user: AppUser, productId: string): Promise<void> {
  const { data } = await createSupabaseAdminClient().from("products").select("seller_id").eq("id", productId).single();
  if (!data || data.seller_id !== user.id) throw new AuthorizationError();
}

export async function listProducts(input: { query?: string; category?: string; condition?: string; minPriceKurus?: number; maxPriceKurus?: number; limit?: number }) {
  const client = createSupabaseAdminClient();
  let query = client.from("products").select("id,title,slug,description,condition,price_kurus,location,created_at,category:categories(name,slug),images:product_images(storage_path,sort_order),verification:product_verifications(status),seller:seller_profiles(display_name,rating_basis_points,completed_sales)").eq("status", "ACTIVE").order("created_at", { ascending: false }).limit(Math.min(input.limit ?? 24, 60));
  if (input.query) query = query.ilike("title", `%${sanitizeText(input.query, 80)}%`);
  if (input.category) query = query.eq("categories.slug", input.category);
  if (input.condition) query = query.eq("condition", input.condition);
  if (input.minPriceKurus !== undefined) query = query.gte("price_kurus", input.minPriceKurus);
  if (input.maxPriceKurus !== undefined) query = query.lte("price_kurus", input.maxPriceKurus);
  const { data, error } = await query;
  if (error) throw new Error("Ürünler yüklenemedi");
  return data;
}

export async function getProductBySlug(slug: string) {
  const { data, error } = await createSupabaseAdminClient().from("products").select("id,seller_id,title,slug,description,condition,price_kurus,status,location,created_at,category:categories(name,slug),images:product_images(storage_path,sort_order),verification:product_verifications(status),seller:seller_profiles(display_name,rating_basis_points,completed_sales,verification_status)").eq("slug", slug).eq("status", "ACTIVE").single();
  if (error || !data) return null;
  return data;
}

export async function listCatalogProducts(input: { query?: string; category?: string; condition?: string } = {}): Promise<CatalogProduct[]> {
  const rows = await listProducts({ ...input, limit: 48 });
  const supabaseUrl = getPublicEnv().NEXT_PUBLIC_SUPABASE_URL;
  return rows.map((row) => {
    const category = Array.isArray(row.category) ? row.category[0] : row.category;
    const seller = Array.isArray(row.seller) ? row.seller[0] : row.seller;
    const verification = Array.isArray(row.verification) ? row.verification[0] : row.verification;
    const images = [...(row.images ?? [])].sort((left, right) => left.sort_order - right.sort_order);
    return { id: row.id, title: row.title, slug: row.slug, category: category?.name ?? "Diğer", categorySlug: category?.slug ?? "diger", condition: row.condition, priceKurus: row.price_kurus, location: row.location, image: images[0] ? `${supabaseUrl}/storage/v1/object/public/product-images/${images[0].storage_path}` : "/globe.svg", seller: seller?.display_name ?? "OrtakPazar üyesi", rating: (seller?.rating_basis_points ?? 0) / 100, verified: verification?.status === "VERIFIED", description: row.description };
  });
}
