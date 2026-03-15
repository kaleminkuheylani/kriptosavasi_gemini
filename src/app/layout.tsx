import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Kripto Analiz Platformu - CoinMarketCap Canli Piyasa ve Teknik Skorlar",
  description:
    "CoinMarketCap tabanli canli kripto para verileri, momentum-volatilite-likidite skorlari ve detayli piyasa analiz araclari.",
  keywords: ["kripto", "bitcoin", "ethereum", "coinmarketcap", "teknik analiz", "crypto dashboard", "piyasa analiz"],
  authors: [{ name: "Kripto Analiz" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Kripto Analiz Platformu",
    description: "CoinMarketCap destekli canli kripto takibi ve detayli analiz araclari",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kripto Analiz Platformu",
    description: "CoinMarketCap destekli canli kripto takibi ve detayli analiz araclari",
  },
  verification: {
    google: "-xkmQLvLRKoxTr5aOPLjjtb-Amy7Tt8OksxuZaJpu8k",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body
        className="antialiased bg-background text-foreground"
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
