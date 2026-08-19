import type { Metadata } from "next";
import "./globals.css";
import "./fixes.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CookieConsent } from "@/components/cookie-consent";
import { headers } from "next/headers";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  const description = "Türkiye için alıcı korumalı, güvenli ve şeffaf C2C alışveriş platformu.";
  return { metadataBase: new URL(`${protocol}://${host}`), title: { default: "OrtakPazar | Güvenli C2C Marketplace", template: "%s | OrtakPazar" }, description, robots: { index: true, follow: true }, openGraph: { title: "OrtakPazar", description, images: [image], type: "website" }, twitter: { card: "summary_large_image", title: "OrtakPazar", description, images: [image] } };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr"><body><SiteHeader/><main className="page-shell">{children}</main><SiteFooter/><CookieConsent/></body></html>;
}
