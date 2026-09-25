import { getMediaSettings } from '@/lib/media/repository';
import { MediaArticleEditor } from '../_components/media-article-editor';

export const dynamic = 'force-dynamic';

export default async function NewMediaArticlePage() {
  const settings = await getMediaSettings();
  return <MediaArticleEditor settings={settings} />;
}
