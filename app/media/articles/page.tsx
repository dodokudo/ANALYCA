import Link from 'next/link';
import type { Metadata } from 'next';
import { getMediaSettings, getPopularMediaArticles, listMediaArticles } from '@/lib/media/repository';
import { DEFAULT_MEDIA_SETTINGS } from '@/lib/media/types';
import { mediaUrl } from '@/lib/media/site';
import { MediaArticleCard } from '../_components/media-article-card';
import { MediaPageView } from '../_components/tracking';
import { MediaSidebar } from '../_components/media-sidebar';
import { MediaTagChips } from '../_components/media-tag-chips';
import styles from '../media.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '記事一覧',
  description: 'ANALYCA MediaのSNS運用・Webマーケティング記事一覧です。',
  alternates: { canonical: mediaUrl('/articles') },
};

export default async function MediaArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() || '';
  const tag = params.tag?.trim() || '';
  const [settings, articles, popular, allArticles] = await Promise.all([
    getMediaSettings().catch(() => DEFAULT_MEDIA_SETTINGS),
    listMediaArticles({ publicOnly: true, limit: 100, query, tag }).catch(() => []),
    getPopularMediaArticles(5).catch(() => []),
    listMediaArticles({ publicOnly: true, limit: 50 }).catch(() => []),
  ]);

  return (
    <main>
      <MediaPageView />
      <MediaTagChips articles={allArticles} activeTag={tag} />
      <div className={styles.articleGrid}>
        <section>
          <div className={styles.breadcrumb}><Link href={mediaUrl('/')}>トップ</Link><span aria-hidden="true">›</span>記事一覧</div>
          <div className={styles.archiveHeader}>
            <div>
              <p className={styles.archiveEyebrow}>ALL ARTICLES</p>
              <h1>{query ? `「${query}」の検索結果` : tag ? `「${tag}」の記事` : '記事一覧'}</h1>
            </div>
            <span className={styles.articleMeta}>{articles.length}件</span>
          </div>
          {articles.length > 0 ? (
            <div className={styles.articleList}>
              {articles.map((article) => <MediaArticleCard article={article} key={article.id} />)}
            </div>
          ) : (
            <p className={styles.empty}>条件に一致する記事はありません。</p>
          )}
        </section>
        <MediaSidebar popularArticles={popular} recentArticles={allArticles.slice(0, 5)} settings={settings} searchQuery={query} />
      </div>
    </main>
  );
}
