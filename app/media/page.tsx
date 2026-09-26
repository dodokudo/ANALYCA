import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getMediaSettings, getPopularMediaArticles, listMediaArticles } from '@/lib/media/repository';
import { DEFAULT_MEDIA_SETTINGS } from '@/lib/media/types';
import { mediaUrl } from '@/lib/media/site';
import { MediaArticleCard } from './_components/media-article-card';
import { MediaPickupCarousel } from './_components/media-pickup-carousel';
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
  const filtered = Boolean(query || tag);
  const [settings, allArticles, filteredArticles, popular] = await Promise.all([
    getMediaSettings().catch(() => DEFAULT_MEDIA_SETTINGS),
    listMediaArticles({ publicOnly: true, limit: 50 }).catch(() => []),
    filtered ? listMediaArticles({ publicOnly: true, limit: 50, query, tag }).catch(() => []) : Promise.resolve(null),
    getPopularMediaArticles(5).catch(() => []),
  ]);
  const articles = filteredArticles ?? allArticles;
  // 固定記事を先頭に、残りは新しい順で最大5件を回す
  const pinned = allArticles.filter((article) => settings.pinnedArticleIds.includes(article.id));
  const pickups = filtered ? [] : [...pinned, ...allArticles.filter((article) => !pinned.includes(article))].slice(0, 5);
  const ranked = filtered ? [] : popular.filter((article) => article.views > 0).slice(0, 3);

  return (
    <main>
      <MediaPageView />
      {!filtered && <h1 className={styles.visuallyHidden}>{settings.siteName}</h1>}
      {pickups.length > 0 && (
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <MediaPickupCarousel articles={pickups} />
          </div>
        </section>
      )}
      <div className={styles.articleGrid}>
        <section>
          {ranked.length > 0 && (
            <div className={styles.popularSection} id="ranking">
              <div className={styles.sectionHeader}><h2>人気記事</h2></div>
              <div className={styles.popularGrid}>
                {ranked.map((article, index) => (
                  <Link href={mediaUrl(`/articles/${article.slug}`)} className={styles.popularCard} key={article.id}>
                    <div className={styles.popularThumb}>
                      <span className={styles.popularRank}>{index + 1}</span>
                      {article.coverImageUrl ? (
                        <Image src={article.coverImageUrl} alt={article.coverImageAlt || ''} fill unoptimized sizes="(max-width: 760px) 112px, 280px" />
                      ) : (
                        <div className={styles.thumbFallback}><span>ANALYCA Media</span></div>
                      )}
                    </div>
                    <h3 className={styles.popularTitle}>{article.title}</h3>
                  </Link>
                ))}
              </div>
            </div>
          )}
          <div className={styles.sectionHeader}>
            {filtered
              ? <h1>{query ? `「${query}」の検索結果` : `「${tag}」の記事`}</h1>
              : <h2>新着記事</h2>}
            {filtered && <span className={styles.articleMeta}>{articles.length}件</span>}
          </div>
          {articles.length > 0 ? (
            <div className={styles.articleList}>
              {articles.map((article) => <MediaArticleCard article={article} key={article.id} />)}
            </div>
          ) : (
            <p className={styles.empty}>
              {filtered ? '条件に一致する記事はありません。' : '公開中の記事はまだありません。'}
            </p>
          )}
          <div className={styles.moreRow}>
            <Link className={styles.buttonOutline} href={mediaUrl('/articles')}>記事一覧を見る</Link>
          </div>
        </section>
        <MediaSidebar
          popularArticles={popular}
          recentArticles={allArticles.slice(0, 5)}
          settings={settings}
          searchQuery={query}
          hideRanking={ranked.length > 0}
        />
      </div>
    </main>
  );
}
