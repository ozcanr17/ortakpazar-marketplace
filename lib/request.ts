import { headers } from "next/headers";

export async function getRequestContext(): Promise<{ ipAddress: string; userAgent: string }> {
  const values = await headers();
  const ipAddress = (values.get("x-forwarded-for") ?? "unknown").split(",")[0].trim().slice(0, 64);
  const userAgent = (values.get("user-agent") ?? "unknown").slice(0, 1000);
  return { ipAddress, userAgent };
}
