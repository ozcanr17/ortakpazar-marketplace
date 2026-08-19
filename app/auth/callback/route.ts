import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next") ?? "/profil";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/profil";
  if (code) {
    const client = await createSupabaseServerClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/giris?error=link", url.origin));
}
