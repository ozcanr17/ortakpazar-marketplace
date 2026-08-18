import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NOVA Outlet | Kaliteli Ürünler, Akıllı Fiyatlar",
  description: "Elektronikten ev yaşam ürünlerine, seçili ürünlerde stoklarla sınırlı fırsatlar ve güvenli alışveriş.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr"><body>{children}</body></html>;
}
