"use server";

import { z } from "zod";
import { assertSameOrigin } from "@/lib/security/csrf";
import { sanitizeText } from "@/lib/security/text";
import { database, ensureDatabase, initialAdminCredentials } from "@/lib/database";
import { createSession, destroyCurrentSession, ensureInitialAdmin } from "@/lib/auth";
import { getRequestContext } from "@/lib/request";
import { hashPassword, hashToken, verifyPassword } from "@/lib/password";
import { passwordSchema, registerSchema } from "@/lib/domain/auth-validation";

export interface AuthActionState { ok: boolean; message: string; redirectTo?: string; fieldErrors?: Record<string, string[]> }

export async function registerAction(input: z.input<typeof registerSchema>): Promise<AuthActionState> {
  try {
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
    await database().batch([
      database().prepare("INSERT INTO users (id,email,password_hash,password_salt,first_name,last_name,role,status,marketing_consent,created_at,updated_at) VALUES (?,?,?,?,?,?,'USER','ACTIVE',?,?,?)").bind(userId, email, password.hash, password.salt, sanitizeText(parsed.data.firstName, 80), sanitizeText(parsed.data.lastName, 80), parsed.data.marketingConsent ? 1 : 0, now, now),
      ...parsed.data.legalDocumentIds.map((documentId) => database().prepare("INSERT INTO legal_acceptances (user_id,document_id,accepted_at,ip_address,user_agent) VALUES (?,?,?,?,?)").bind(userId, documentId, now, context.ipAddress, context.userAgent)),
    ]);
    await createSession(userId, true);
    return { ok: true, message: "Hesabınız oluşturuldu", redirectTo: "/profil" };
  } catch { return { ok: false, message: "Kayıt tamamlanamadı. Lütfen tekrar deneyin" }; }
}

const loginSchema = z.object({ email: z.string().trim().min(1).max(320), password: z.string().min(1).max(128), returnTo: z.string().startsWith("/").refine((value) => !value.startsWith("//")).default("/profil"), remember: z.boolean().optional() });

export async function loginAction(input: z.input<typeof loginSchema>): Promise<AuthActionState> {
  try {
    await assertSameOrigin();
    await ensureInitialAdmin();
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: "E-posta veya parola hatalı" };
    const identifier = parsed.data.email.toLowerCase();
    const adminEmail = initialAdminCredentials()?.email;
    const email = identifier === "admin" ? adminEmail : identifier === adminEmail ? undefined : z.string().email().safeParse(identifier).data;
    if (!email) return { ok: false, message: "E-posta veya parola hatalı" };
    const row = await database().prepare("SELECT id,password_hash,password_salt,status FROM users WHERE email = ? COLLATE NOCASE LIMIT 1").bind(email).first<{ id: string; password_hash: string; password_salt: string; status: string }>();
    if (!row || row.status !== "ACTIVE" || !(await verifyPassword(parsed.data.password, row.password_salt, row.password_hash))) return { ok: false, message: "E-posta veya parola hatalı" };
    await createSession(row.id, parsed.data.remember ?? true);
    return { ok: true, message: "Giriş başarılı", redirectTo: parsed.data.returnTo };
  } catch { return { ok: false, message: "Giriş şu anda tamamlanamadı. Lütfen tekrar deneyin" }; }
}

export async function logoutAction(): Promise<AuthActionState> {
  try { await assertSameOrigin(); await destroyCurrentSession(); return { ok: true, message: "Çıkış yapıldı", redirectTo: "/" }; }
  catch { return { ok: false, message: "Çıkış tamamlanamadı" }; }
}

export async function forgotPasswordAction(emailInput: string): Promise<AuthActionState> {
  try {
    await assertSameOrigin();
    await ensureDatabase();
    const email = z.string().email().parse(emailInput.trim().toLowerCase());
    const user = await database().prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE AND status = 'ACTIVE'").bind(email).first<{ id: string }>();
    if (!user) return { ok: true, message: "Hesap varsa sıfırlama bağlantısı oluşturuldu" };
    const token = crypto.randomUUID() + crypto.randomUUID();
    const now = new Date();
    await database().batch([
      database().prepare("UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL").bind(now.toISOString(), user.id),
      database().prepare("INSERT INTO password_reset_tokens (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), user.id, await hashToken(token), new Date(now.getTime() + 30 * 60 * 1000).toISOString(), now.toISOString()),
    ]);
    return { ok: true, message: "Demo sıfırlama bağlantısı 30 dakika geçerlidir", redirectTo: `/sifre-yenile?token=${encodeURIComponent(token)}` };
  } catch { return { ok: false, message: "Geçerli bir e-posta adresi girin" }; }
}

export async function resetPasswordAction(input: { token: string; password: string }): Promise<AuthActionState> {
  try {
    await assertSameOrigin();
    await ensureDatabase();
    const parsed = z.object({ token: z.string().min(20).max(200), password: passwordSchema }).parse(input);
    const tokenHash = await hashToken(parsed.token);
    const row = await database().prepare("SELECT id,user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? LIMIT 1").bind(tokenHash, new Date().toISOString()).first<{ id: string; user_id: string }>();
    if (!row) return { ok: false, message: "Sıfırlama bağlantısı geçersiz veya süresi dolmuş" };
    const password = await hashPassword(parsed.password);
    const now = new Date().toISOString();
    await database().batch([
      database().prepare("UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?").bind(password.hash, password.salt, now, row.user_id),
      database().prepare("UPDATE password_reset_tokens SET used_at = ? WHERE id = ?").bind(now, row.id),
      database().prepare("DELETE FROM sessions WHERE user_id = ?").bind(row.user_id),
    ]);
    return { ok: true, message: "Parolanız güncellendi", redirectTo: "/giris" };
  } catch { return { ok: false, message: "Parola en az 10 karakter, büyük harf, küçük harf ve rakam içermelidir" }; }
}
