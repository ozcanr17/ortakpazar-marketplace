"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/security/csrf";
import { sanitizeText } from "@/lib/security/text";
import { database, ensureDatabase, initialAdminCredentials } from "@/lib/database";
import { createSession, destroyCurrentSession, ensureInitialAdmin } from "@/lib/auth";
import { getRequestContext } from "@/lib/request";
import { hashPassword, verifyPassword } from "@/lib/password";
import { passwordSchema, registerSchema } from "@/lib/domain/auth-validation";

export interface AuthActionState { ok: boolean; message: string; redirectTo?: string; fieldErrors?: Record<string, string[]> }

export async function registerAction(input: z.input<typeof registerSchema>): Promise<AuthActionState> {
  await assertSameOrigin();
  await ensureDatabase();
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Bilgileri kontrol edin", fieldErrors: parsed.error.flatten().fieldErrors };
  const email = parsed.data.email.trim().toLowerCase();
  if (await database().prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE LIMIT 1").bind(email).first()) return { ok: false, message: "Bu e-posta adresiyle bir hesap zaten var" };
  const placeholders = parsed.data.legalDocumentIds.map(() => "?").join(",");
  const documents = await database().prepare(`SELECT id,type FROM legal_documents WHERE active = 1 AND id IN (${placeholders})`).bind(...parsed.data.legalDocumentIds).all<{ id: string; type: string }>();
  const acceptedTypes = new Set(documents.results.map((document) => document.type));
  if (!acceptedTypes.has("USER_AGREEMENT") || !acceptedTypes.has("KVKK_NOTICE")) return { ok: false, message: "Güncel zorunlu metinleri kabul etmelisiniz" };
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  const password = await hashPassword(parsed.data.password);
  const context = await getRequestContext();
  try {
    await database().batch([
      database().prepare("INSERT INTO users (id,email,password_hash,password_salt,first_name,last_name,role,status,marketing_consent,created_at,updated_at) VALUES (?,?,?,?,?,?,'USER','ACTIVE',?,?,?)").bind(userId, email, password.hash, password.salt, sanitizeText(parsed.data.firstName, 80), sanitizeText(parsed.data.lastName, 80), parsed.data.marketingConsent ? 1 : 0, now, now),
      ...parsed.data.legalDocumentIds.map((documentId) => database().prepare("INSERT INTO legal_acceptances (user_id,document_id,accepted_at,ip_address,user_agent) VALUES (?,?,?,?,?)").bind(userId, documentId, now, context.ipAddress, context.userAgent)),
    ]);
    await createSession(userId, true);
    return { ok: true, message: "Hesabınız oluşturuldu. Profilinize yönlendiriliyorsunuz" };
  } catch { return { ok: false, message: "Kayıt tamamlanamadı" }; }
}

const loginSchema = z.object({ email: z.string().trim().min(1).max(320), password: z.string().min(1).max(128), returnTo: z.string().startsWith("/").refine((value) => !value.startsWith("//")).default("/profil"), remember: z.boolean().optional() });
export async function loginAction(input: z.input<typeof loginSchema>): Promise<AuthActionState> {
  await assertSameOrigin();
  await ensureInitialAdmin();
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "E-posta veya parola hatalı" };
  const identifier = parsed.data.email.toLowerCase();
  const email = identifier === "admin" ? initialAdminCredentials()?.email : z.string().email().safeParse(identifier).data;
  if (!email) return { ok: false, message: "E-posta veya parola hatalı" };
  const row = await database().prepare("SELECT id,password_hash,password_salt,status FROM users WHERE email = ? COLLATE NOCASE LIMIT 1").bind(email).first<{ id: string; password_hash: string; password_salt: string; status: string }>();
  if (!row || row.status !== "ACTIVE" || !(await verifyPassword(parsed.data.password, row.password_salt, row.password_hash))) return { ok: false, message: "E-posta veya parola hatalı" };
  await createSession(row.id, parsed.data.remember ?? true);
  return { ok: true, message: "Giriş başarılı", redirectTo: parsed.data.returnTo };
}

export async function logoutAction(): Promise<void> { await assertSameOrigin(); await destroyCurrentSession(); redirect("/"); }
export async function forgotPasswordAction(email: string): Promise<AuthActionState> { await assertSameOrigin(); return z.string().email().safeParse(email).success ? { ok: true, message: "Hesap varsa sıfırlama talebi yöneticiye iletildi" } : { ok: false, message: "Geçerli bir e-posta adresi girin" }; }
export async function resetPasswordAction(password: string): Promise<AuthActionState> { await assertSameOrigin(); return passwordSchema.safeParse(password).success ? { ok: false, message: "Geçerli bir parola sıfırlama bağlantısı gerekli" } : { ok: false, message: "Parola en az 10 karakter, büyük harf, küçük harf ve rakam içermelidir" }; }
