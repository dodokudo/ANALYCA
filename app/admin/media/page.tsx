import { getMediaOverview, getMediaSettings, listMediaArticles } from '@/lib/media/repository';
import { MediaAdminDashboard } from './_components/media-admin-dashboard';

export const dynamic = 'force-dynamic';

export default async function MediaAdminPage() {
  const [articles, overview, settings] = await Promise.all([
    listMediaArticles({ limit: 100 }),
    getMediaOverview(),
    getMediaSettings(),
  ]);
  return <MediaAdminDashboard initialArticles={articles} overview={overview} initialSettings={settings} />;
}
