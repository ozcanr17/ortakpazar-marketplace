import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthorizationError } from "@/lib/domain/errors";
import { database, ensureDatabase, initialAdminCredentials } from "@/lib/database";
import { hashPassword, hashToken } from "@/lib/password";

export type UserRole = "USER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";
export interface AppUser { id: string; authUserId: string; email: string; role: UserRole; status: "ACTIVE" | "SUSPENDED" | "BANNED" | "DELETION_PENDING"; sessionInvalidBefore: string | null; firstName: string; lastName: string }
interface UserRow { id: string; email: string; role: UserRole; status: AppUser["status"]; first_name: string; last_name: string }

export async function ensureInitialAdmin(): Promise<void> {
  await ensureDatabase();
  const credentials = initialAdminCredentials();
  if (!credentials) return;
  const existing = await database().prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE LIMIT 1").bind(credentials.email).first<{ id: string }>();
  if (existing) return;
  const password = await hashPassword(credentials.password);
  const now = new Date().toISOString();
  await database().prepare("INSERT INTO users (id,email,password_hash,password_salt,first_name,last_name,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,'SUPER_ADMIN','ACTIVE',?,?)").bind(crypto.randomUUID(), credentials.email, password.hash, password.salt, "Platform", "Yöneticisi", now, now).run();
}

export async function getCurrentUser(): Promise<AppUser | null> {
  await ensureDatabase();
  const token = (await cookies()).get("ortakpazar_session")?.value;
  if (!token) return null;
  const row = await database().prepare(`SELECT u.id,u.email,u.role,u.status,u.first_name,u.last_name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1`).bind(await hashToken(token), new Date().toISOString()).first<UserRow>();
  if (!row || row.status !== "ACTIVE") return null;
  return { id: row.id, authUserId: row.id, email: row.email, role: row.role, status: row.status, sessionInvalidBefore: null, firstName: row.first_name, lastName: row.last_name };
}

export async function createSession(userId: string, persistent: boolean): Promise<void> {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + (persistent ? 30 : 1) * 24 * 60 * 60 * 1000);
  await database().prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), userId, await hashToken(token), expires.toISOString(), now.toISOString(), now.toISOString()).run();
  (await cookies()).set("ortakpazar_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires });
}

export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get("ortakpazar_session")?.value;
  if (token) await database().prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await hashToken(token)).run();
  store.delete("ortakpazar_session");
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

export async function requireAdmin(): Promise<AppUser> { return requireRole(["MODERATOR", "ADMIN", "SUPER_ADMIN"]); }
export async function requireRecentAuthentication(): Promise<AppUser> { return requireAdmin(); }
