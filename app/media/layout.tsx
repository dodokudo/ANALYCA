import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getMediaSettings } from '@/lib/media/repository';
import { DEFAULT_MEDIA_SETTINGS } from '@/lib/media/types';
import { MEDIA_ORIGIN } from '@/lib/media/site';
import { MediaShell } from './_components/media-shell';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getMediaSettings().catch(() => DEFAULT_MEDIA_SETTINGS);
  return {
    metadataBase: new URL(MEDIA_ORIGIN),
    title: { default: settings.siteName, template: `%s | ${settings.siteName}` },
    description: settings.siteDescription,
    alternates: { canonical: MEDIA_ORIGIN },
    openGraph: {
      type: 'website',
      locale: 'ja_JP',
      siteName: settings.siteName,
      title: settings.siteName,
      description: settings.siteDescription,
      url: MEDIA_ORIGIN,
    },
    twitter: { card: 'summary_large_image', title: settings.siteName, description: settings.siteDescription },
  };
}

export default async function MediaLayout({ children }: { children: ReactNode }) {
  const settings = await getMediaSettings().catch(() => DEFAULT_MEDIA_SETTINGS);
  return <MediaShell settings={settings}>{children}</MediaShell>;
}
