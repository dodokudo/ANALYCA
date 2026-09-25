import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getMediaSettings, getPopularMediaArticles, listMediaArticles } from '@/lib/media/repository';
import { DEFAULT_MEDIA_SETTINGS } from '@/lib/media/types';
import type { MediaArticle } from '@/lib/media/types';
import { mediaUrl } from '@/lib/media/site';
import { MediaArticleCard } from './_components/media-article-card';
import { MediaPageView } from './_components/tracking';
import { MediaSidebar } from './_components/media-sidebar';
import { MediaTagChips } from './_components/media-tag-chips';
import styles from './media.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  alternates: { canonical: mediaUrl('/') },
};

function dateLabel(article: MediaArticle): string {
  return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeZone: 'Asia/Tokyo' })
    .format(new Date(article.publishedAt || article.updatedAt));
}

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
  const pickup = !filtered
    ? allArticles.find((article) => settings.pinnedArticleIds.includes(article.id)) || allArticles[0]
    : undefined;
  const listed = pickup ? articles.filter((article) => article.id !== pickup.id) : articles;

  return (
    <main>
      <MediaPageView />
      <MediaTagChips articles={allArticles} activeTag={tag} />
      {pickup && (
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <Link href={mediaUrl(`/articles/${pickup.slug}`)} className={styles.pickup}>
              <div className={styles.pickupThumb}>
                {pickup.coverImageUrl ? (
                  <Image src={pickup.coverImageUrl} alt={pickup.coverImageAlt || ''} fill unoptimized priority sizes="(max-width: 900px) calc(100vw - 32px), 420px" />
                ) : (
                  <div className={styles.thumbFallback}><span>{pickup.tags[0] || 'ANALYCA'}</span></div>
                )}
              </div>
              <div className={styles.pickupBody}>
                <div className={styles.tags}>
                  <span className={styles.tagStrong}>ピックアップ</span>
                  {pickup.tags.slice(0, 2).map((item) => <span className={styles.tag} key={item}>{item}</span>)}
                </div>
                <h2 className={styles.pickupTitle}>{pickup.title}</h2>
                <p className={styles.pickupDescription}>{pickup.description}</p>
                <time className={styles.articleDate} dateTime={pickup.publishedAt || pickup.updatedAt}>{dateLabel(pickup)}</time>
              </div>
            </Link>
            <div className={styles.heroAbout}>
              <h1 className={styles.heroTitle}>{settings.siteName}</h1>
              <p>{settings.siteDescription}</p>
            </div>
          </div>
        </section>
      )}
      <div className={styles.articleGrid}>
        <section>
          <div className={styles.sectionHeader}>
            {filtered
              ? <h1>{query ? `「${query}」の検索結果` : `「${tag}」の記事`}</h1>
              : <h2>新着記事</h2>}
            {filtered && <span className={styles.articleMeta}>{articles.length}件</span>}
          </div>
          {listed.length > 0 ? (
            <div className={styles.articleList}>
              {listed.map((article) => <MediaArticleCard article={article} key={article.id} />)}
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
        <MediaSidebar popularArticles={popular} recentArticles={allArticles.slice(0, 5)} settings={settings} searchQuery={query} />
      </div>
    </main>
  );
}
