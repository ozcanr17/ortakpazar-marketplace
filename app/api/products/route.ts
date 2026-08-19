import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createPersistentProduct } from "@/lib/persistent-marketplace";
import { assertSameOrigin } from "@/lib/security/csrf";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { sanitizeText } from "@/lib/security/text";
import { DomainError } from "@/lib/domain/errors";

const productSchema = z.object({
  title: z.string().min(5).max(160),
  description: z.string().min(20).max(10000),
  categoryId: z.string().uuid(),
  condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR"]),
  priceLira: z.number().positive().max(1_000_000),
  location: z.string().min(2).max(120),
});

export async function POST(request: Request): Promise<Response> {
  try {
    await assertSameOrigin();
    const user = await getCurrentUser();
    if (!user) return Response.json({ ok: false, message: "İlan vermek için giriş yapmalısınız" }, { status: 401 });
    await enforceRateLimit(`product:${user.id}`, 20, 3600, 3600);
    const formData = await request.formData();
    const parsed = productSchema.parse({
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      categoryId: String(formData.get("categoryId") ?? ""),
      condition: String(formData.get("condition") ?? ""),
      priceLira: Number(formData.get("price")),
      location: String(formData.get("location") ?? ""),
    });
    const files = formData.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
    const id = await createPersistentProduct(user, {
      title: sanitizeText(parsed.title, 160),
      description: sanitizeText(parsed.description, 10000),
      categoryId: parsed.categoryId,
      condition: parsed.condition,
      priceKurus: Math.round(parsed.priceLira * 100),
      location: sanitizeText(parsed.location, 120),
    }, files);
    return Response.json({ ok: true, message: "İlan incelemeye gönderildi", id });
  } catch (error) {
    const message = error instanceof DomainError ? error.message : error instanceof z.ZodError ? "İlan bilgilerini kontrol edin" : "İlan gönderilemedi";
    return Response.json({ ok: false, message }, { status: 400 });
  }
}
