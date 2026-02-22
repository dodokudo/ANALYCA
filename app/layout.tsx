import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DateRangeProvider } from "../lib/dateRangeStore";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ANALYCA - SNS分析ダッシュボード",
  description: "Threads・Instagramなどの数値分析が一目でできる！",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
    ],
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'ANALYCA - SNS分析ダッシュボード',
    description: 'Threads・Instagramなどの数値分析が一目でできる！',
    siteName: 'ANALYCA',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
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
