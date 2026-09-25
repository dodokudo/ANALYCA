import { notFound } from 'next/navigation';
import { getMediaArticleById, getMediaSettings, listMediaRevisions } from '@/lib/media/repository';
import { MediaArticleEditor } from '../_components/media-article-editor';

export const dynamic = 'force-dynamic';

export default async function EditMediaArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [article, settings, revisions] = await Promise.all([
    getMediaArticleById(id),
    getMediaSettings(),
    listMediaRevisions(id),
  ]);
  if (!article) notFound();
  return <MediaArticleEditor initialArticle={article} settings={settings} revisions={revisions} />;
}
