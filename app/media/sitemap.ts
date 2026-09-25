import type { MetadataRoute } from 'next';
import { listMediaArticles } from '@/lib/media/repository';
import { mediaUrl } from '@/lib/media/site';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await listMediaArticles({ publicOnly: true, limit: 100 }).catch(() => []);
  return [
    { url: mediaUrl('/'), lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: mediaUrl('/articles'), changeFrequency: 'daily', priority: 0.9 },
    ...articles.map((article) => ({
      url: mediaUrl(`/articles/${article.slug}`),
      lastModified: new Date(article.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
