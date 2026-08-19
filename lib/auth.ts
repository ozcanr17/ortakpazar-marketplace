import { redirect } from "next/navigation";
import { AuthorizationError } from "@/lib/domain/errors";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export type UserRole = "USER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";
export interface AppUser { id: string; authUserId: string; email: string; role: UserRole; status: "ACTIVE" | "SUSPENDED" | "BANNED" | "DELETION_PENDING"; sessionInvalidBefore: string | null }

export async function getCurrentUser(): Promise<AppUser | null> {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data, error } = await createSupabaseAdminClient().from("users").select("id,auth_user_id,email,role,status,session_invalid_before").eq("auth_user_id", user.id).single();
  if (error || !data || data.status !== "ACTIVE") return null;
  if (data.session_invalid_before && user.last_sign_in_at && new Date(user.last_sign_in_at) < new Date(data.session_invalid_before)) return null;
  return { id: data.id, authUserId: data.auth_user_id, email: data.email, role: data.role as UserRole, status: data.status, sessionInvalidBefore: data.session_invalid_before };
}

export async function requireUser(returnTo = "/profil"): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/giris?returnTo=${encodeURIComponent(returnTo)}`);
  return user;
}

export async function requireRole(roles: readonly UserRole[]): Promise<AppUser> {
  const user = await requireUser("/admin");
  if (!roles.includes(user.role)) throw new AuthorizationError();
  return user;
}

export async function requireAdmin(): Promise<AppUser> {
  return requireRole(["MODERATOR", "ADMIN", "SUPER_ADMIN"]);
}

export async function requireRecentAuthentication(maxAgeMinutes = 15): Promise<AppUser> {
  const user = await requireUser();
  const client = await createSupabaseServerClient();
  const { data: { user: authUser } } = await client.auth.getUser();
  if (!authUser?.last_sign_in_at || Date.now() - new Date(authUser.last_sign_in_at).getTime() > maxAgeMinutes * 60_000) throw new AuthorizationError("Bu işlem için yeniden giriş yapmalısınız");
  return user;
}
