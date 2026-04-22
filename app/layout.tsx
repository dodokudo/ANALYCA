import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { DateRangeProvider } from "../lib/dateRangeStore";
import { GA_MEASUREMENT_ID } from "@/lib/gtag";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://analyca.jp'),
  title: "ANALYCA - AIでThreads運用をもっと賢く、もっと成果に。",
  description: "AIが改善提案から投稿作成・予約投稿までサポート。Threads・Instagramの数値分析が一目でできるSNS運用ツール。",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
    ],
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: '【7日間無料】今すぐ詳細を確認する！',
    description: 'AIが改善提案から投稿作成・予約投稿までサポート。Threads・Instagramの数値分析が一目でできるSNS運用ツール。',
    url: 'https://analyca.jp',
    siteName: 'ANALYCA',
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '【7日間無料】今すぐ詳細を確認する！',
    description: 'AIが改善提案から投稿作成・予約投稿までサポート。Threads・Instagramの数値分析が一目でできるSNS運用ツール。',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <Script
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        />
        <Script
          id="gtag-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}');
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <DateRangeProvider>
          {children}
        </DateRangeProvider>
      </body>
    </html>
  );
}
