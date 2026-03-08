import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
