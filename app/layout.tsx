import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "Paperly", description: "Read papers into your own questions" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f7f3eb" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body><header className="topbar"><Link href="/" className="brand">paperly</Link><span>read into questions</span></header>{children}</body></html>;
}
