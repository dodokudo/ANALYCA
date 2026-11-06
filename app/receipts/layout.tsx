import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '領収書・請求書｜株式会社DoDo',
  description: '株式会社DoDoの領収書・請求書の発行とダウンロードのご案内です。',
  robots: { index: false, follow: false },
  openGraph: {
    title: '領収書・請求書｜株式会社DoDo',
    description: '領収書・請求書の発行とダウンロードはこちらから。',
    siteName: '株式会社DoDo',
    locale: 'ja_JP',
    type: 'website',
    // Do not inherit the root marketing images or expose signed download URLs.
    url: 'https://analyca.jp/receipts',
    images: [],
  },
  twitter: {
    card: 'summary',
    title: '領収書・請求書｜株式会社DoDo',
    description: '領収書・請求書の発行とダウンロードはこちらから。',
    images: [],
  },
};

export default function ReceiptsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
