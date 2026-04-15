import type { Viewport } from 'next';

export const viewport: Viewport = {
  width: 650,
  initialScale: 0.58,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function DemoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
