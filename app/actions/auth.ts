"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/security/csrf";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { sanitizeText } from "@/lib/security/text";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { getRequestContext } from "@/lib/request";
import { getPublicEnv } from "@/lib/env";
import { passwordSchema, registerSchema } from "@/lib/domain/auth-validation";

export interface AuthActionState { ok: boolean; message: string; fieldErrors?: Record<string, string[]> }

export async function registerAction(input: z.input<typeof registerSchema>): Promise<AuthActionState> {
  await assertSameOrigin();
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Bilgileri kontrol edin", fieldErrors: parsed.error.flatten().fieldErrors };
  const context = await getRequestContext();
  const email = parsed.data.email.trim().toLocaleLowerCase("tr-TR");
  await enforceRateLimit(`register:${context.ipAddress}`, 5, 3600, 3600);
  const admin = createSupabaseAdminClient();
  const { data: legalDocuments, error: legalError } = await admin.from("legal_documents").select("id,type").in("id", parsed.data.legalDocumentIds).eq("active", true);
  if (legalError || !legalDocuments || legalDocuments.length !== parsed.data.legalDocumentIds.length) return { ok: false, message: "Güncel sözleşmeler onaylanmalıdır" };
  const required = new Set(["USER_AGREEMENT", "KVKK_NOTICE"]);
  if (!legalDocuments.every((document) => required.has(document.type)) || legalDocuments.length < required.size) return { ok: false, message: "Zorunlu sözleşmeler onaylanmalıdır" };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({ email, password: parsed.data.password, options: { emailRedirectTo: `${getPublicEnv().NEXT_PUBLIC_APP_URL}/auth/callback` } });
  if (error || !data.user) return { ok: false, message: "Kayıt oluşturulamadı. Bilgileri kontrol edin" };
  const userId = crypto.randomUUID();
  const { error: userError } = await admin.from("users").insert({ id: userId, auth_user_id: data.user.id, email });
  const { error: profileError } = await admin.from("profiles").insert({ user_id: userId, first_name: sanitizeText(parsed.data.firstName, 80), last_name: sanitizeText(parsed.data.lastName, 80) });
  if (userError || profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, message: "Kayıt tamamlanamadı" };
  }
  const acceptances = parsed.data.legalDocumentIds.map((documentId) => ({ user_id: userId, document_id: documentId, ip_address: context.ipAddress, user_agent: context.userAgent }));
  const consents = [
    { user_id: userId, category: "NECESSARY", granted: true, policy_version: "1.0", ip_address: context.ipAddress, user_agent: context.userAgent },
    { user_id: userId, category: "MARKETING", granted: parsed.data.marketingConsent, policy_version: "1.0", ip_address: context.ipAddress, user_agent: context.userAgent },
  ];
  await Promise.all([admin.from("legal_acceptances").insert(acceptances), admin.from("consent_history").insert(consents)]);
  return { ok: true, message: "Doğrulama bağlantısı e-posta adresinize gönderildi" };
}

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1).max(128), returnTo: z.string().startsWith("/").default("/profil") });

export async function loginAction(input: z.input<typeof loginSchema>): Promise<AuthActionState> {
  await assertSameOrigin();
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "E-posta veya parola hatalı" };
  const context = await getRequestContext();
  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const fingerprint = createHash("sha256").update(normalizedEmail).digest("hex").slice(0, 20);
  await enforceRateLimit(`login:${context.ipAddress}:${fingerprint}`, 8, 900, 1800);
  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.signInWithPassword({ email: normalizedEmail, password: parsed.data.password });
  if (error || !data.user) return { ok: false, message: "E-posta veya parola hatalı" };
  const { data: appUser } = await createSupabaseAdminClient().from("users").select("status").eq("auth_user_id", data.user.id).single();
  if (!appUser || appUser.status !== "ACTIVE") {
    await client.auth.signOut();
    return { ok: false, message: "Hesap erişime açık değil" };
  }
  redirect(parsed.data.returnTo);
}

export async function logoutAction(): Promise<void> {
  await assertSameOrigin();
  const client = await createSupabaseServerClient();
  await client.auth.signOut();
  redirect("/");
}

export async function forgotPasswordAction(email: string): Promise<AuthActionState> {
  await assertSameOrigin();
  const parsed = z.string().email().safeParse(email);
  if (!parsed.success) return { ok: false, message: "Geçerli bir e-posta adresi girin" };
  const context = await getRequestContext();
  await enforceRateLimit(`forgot:${context.ipAddress}`, 5, 3600, 3600);
  const client = await createSupabaseServerClient();
  await client.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${getPublicEnv().NEXT_PUBLIC_APP_URL}/auth/callback?next=/sifre-yenile` });
  return { ok: true, message: "Hesap varsa parola sıfırlama bağlantısı gönderildi" };
}

export async function resetPasswordAction(password: string): Promise<AuthActionState> {
  await assertSameOrigin();
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { ok: false, message: "Parola en az 10 karakter, büyük harf, küçük harf ve rakam içermelidir" };
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { ok: false, message: "Sıfırlama bağlantısı geçersiz veya süresi dolmuş" };
  const { error } = await client.auth.updateUser({ password: parsed.data });
  if (error) return { ok: false, message: "Parola güncellenemedi" };
  await createSupabaseAdminClient().from("users").update({ session_invalid_before: new Date().toISOString(), last_reauthenticated_at: new Date().toISOString() }).eq("auth_user_id", user.id);
  return { ok: true, message: "Parolanız güncellendi" };
}
