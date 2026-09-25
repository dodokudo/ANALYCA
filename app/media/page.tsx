import type { Metadata } from 'next';
import { getMediaSettings, getPopularMediaArticles, listMediaArticles } from '@/lib/media/repository';
import { DEFAULT_MEDIA_SETTINGS } from '@/lib/media/types';
import { mediaUrl } from '@/lib/media/site';
import { MediaArticleCard } from './_components/media-article-card';
import { MediaPageView } from './_components/tracking';
import { MediaSidebar } from './_components/media-sidebar';
import styles from './media.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  alternates: { canonical: mediaUrl('/') },
};

export default async function MediaHomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() || '';
  const tag = params.tag?.trim() || '';
  const [settings, articles, popular] = await Promise.all([
    getMediaSettings().catch(() => DEFAULT_MEDIA_SETTINGS),
    listMediaArticles({ publicOnly: true, limit: 50, query, tag }).catch(() => []),
    getPopularMediaArticles(5).catch(() => []),
  ]);
  return (
    <main className={styles.main}>
      <MediaPageView />
      <section className={styles.hero}>
        <h1>運用の答えを、<br />実行できる形に。</h1>
        <div>
          <p>{settings.siteDescription}</p>
          <form className={styles.searchForm} action={mediaUrl('/')} method="get">
            <input name="q" defaultValue={query} placeholder="記事を検索" aria-label="記事を検索" />
            <button type="submit">検索</button>
          </form>
        </div>
      </section>
      <div className={styles.articleGrid} style={{ width: '100%', paddingBottom: 0 }}>
        <section>
          <div className={styles.sectionHeader}>
            <h2>{query ? `「${query}」の検索結果` : tag ? `「${tag}」の記事` : '新着記事'}</h2>
            <span className={styles.articleMeta}>{articles.length}件</span>
          </div>
          {articles.length > 0 ? (
            <div className={styles.articleList}>
              {articles.map((article) => <MediaArticleCard article={article} key={article.id} />)}
            </div>
          ) : (
            <p className={styles.empty}>公開中の記事はまだありません。管理画面で記事を承認・公開すると、ここに表示されます。</p>
          )}
        </section>
        <MediaSidebar popularArticles={popular} recentArticles={articles.slice(0, 5)} settings={settings} />
      </div>
    </main>
  );
}
