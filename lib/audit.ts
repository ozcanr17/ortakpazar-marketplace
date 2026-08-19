import { createHash, createHmac } from "node:crypto";
import { getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export interface AuditInput { actorId: string | null; action: string; targetType: string; targetId: string; oldValue?: Record<string, unknown>; newValue?: Record<string, unknown>; ipAddress?: string | null; userAgent?: string | null }

export async function appendAuditLog(input: AuditInput): Promise<void> {
  const client = createSupabaseAdminClient();
  const { data: previous } = await client.from("audit_logs").select("entry_hash").order("timestamp", { ascending: false }).limit(1).maybeSingle();
  const previousHash = previous?.entry_hash ?? null;
  const payload = JSON.stringify({ ...input, previousHash, timestamp: new Date().toISOString() });
  const digest = createHash("sha256").update(payload).digest("hex");
  const entryHash = createHmac("sha256", getServerEnv().AUDIT_HASH_SECRET).update(digest).digest("hex");
  const { error } = await client.from("audit_logs").insert({ actor_id: input.actorId, action: input.action, target_type: input.targetType, target_id: input.targetId, old_value: input.oldValue, new_value: input.newValue, ip_address: input.ipAddress, user_agent: input.userAgent, previous_hash: previousHash, entry_hash: entryHash });
  if (error) throw new Error("Audit kaydı oluşturulamadı");
}
