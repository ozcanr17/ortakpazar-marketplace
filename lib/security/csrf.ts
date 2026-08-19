import { headers } from "next/headers";
import { DomainError } from "@/lib/domain/errors";

export async function assertSameOrigin(): Promise<void> {
  if (process.env.NODE_ENV === "test") return;
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!origin || !host || new URL(origin).host !== host) throw new DomainError("CSRF_REJECTED", "İstek doğrulanamadı");
}
