import { headers } from "next/headers";
import { DomainError } from "@/lib/domain/errors";

export async function assertSameOrigin(): Promise<void> {
  if (process.env.NODE_ENV === "test") return;
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const hosts = [requestHeaders.get("host"), requestHeaders.get("x-forwarded-host"), requestHeaders.get("x-original-host")]
    .flatMap((value) => value?.split(",") ?? [])
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (origin) {
    try {
      if (hosts.includes(new URL(origin).host.toLowerCase())) return;
    } catch {
      throw new DomainError("CSRF_REJECTED", "İstek doğrulanamadı");
    }
  }
  if (!origin && requestHeaders.get("sec-fetch-site") === "same-origin") return;
  throw new DomainError("CSRF_REJECTED", "İstek doğrulanamadı");
}
