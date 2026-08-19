import { DomainError } from "@/lib/domain/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number, blockSeconds: number): Promise<void> {
  const { data, error } = await createSupabaseAdminClient().rpc("check_rate_limit", { p_key: key, p_limit: limit, p_window_seconds: windowSeconds, p_block_seconds: blockSeconds });
  if (error || data !== true) throw new DomainError("RATE_LIMITED", "Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin");
}
