import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "BIST 100 Egitim Platformu - Canli Hisse Verileri ve Teknik Gosterge Egitimi",
  description:
    "Borsa Istanbul hisse senetleri icin canli fiyatlar, grafikler ve teknik gosterge odakli egitim icerikleri. Bu platform yatirim tavsiyesi sunmaz.",
  keywords: ["BIST", "BIST 100", "Borsa Istanbul", "hisse senedi", "borsa", "teknik analiz egitimi", "finansal okuryazarlik"],
  authors: [{ name: "BIST 100 Analiz" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "BIST 100 Egitim Platformu",
    description: "Canli hisse takibi ve teknik gosterge odakli egitimsel analiz",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BIST 100 Egitim Platformu",
    description: "Canli hisse takibi ve teknik gosterge odakli egitimsel analiz",
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
