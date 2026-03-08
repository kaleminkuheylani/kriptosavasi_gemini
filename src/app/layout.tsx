import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "BIST 100 Analiz - Canlı Hisse Takibi ve AI Analizi",
  description: "Borsa İstanbul hisse senetleri için canlı fiyatlar, grafikler, takip listesi ve AI destekli teknik analiz. Asenax API ile gerçek zamanlı veriler.",
  keywords: ["BIST", "BIST 100", "Borsa İstanbul", "hisse senedi", "borsa", "yatırım", "AI analiz", "teknik analiz"],
  authors: [{ name: "BIST 100 Analiz" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "BIST 100 Analiz",
    description: "Canlı hisse takibi ve AI destekli analiz",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BIST 100 Analiz",
    description: "Canlı hisse takibi ve AI destekli analiz",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased bg-background text-foreground"
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
