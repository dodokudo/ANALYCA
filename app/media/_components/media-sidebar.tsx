import Image from 'next/image';
import Link from 'next/link';
import type { MediaArticle, MediaArticleWithViews, MediaSettings } from '@/lib/media/types';
import { ANALYCA_SIGNUP_URL, mediaUrl } from '@/lib/media/site';
import { TrackedLink } from './tracked-link';
import { ArticleRenderer } from './article-renderer';
import { MediaSearchForm } from './media-search-form';
import styles from '../media.module.css';

function shortDate(value: string): string {
  return new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Tokyo' }).format(new Date(value));
}

export function MediaLineBanner({ settings, articleId, placement }: { settings: MediaSettings; articleId?: string; placement: string }) {
  if (!settings.lineUrl) return null;
  return (
    <section className={styles.lineBanner}>
      {settings.lineBannerImageUrl && (
        <div className={styles.lineBannerImage}>
          <Image src={settings.lineBannerImageUrl} alt="" fill unoptimized sizes="320px" />
        </div>
      )}
      <div className={styles.lineBannerBody}>
        <span className={styles.lineBadge}>LINE限定</span>
        <h2>{settings.lineHeadline}</h2>
        <p>{settings.lineBody}</p>
        <TrackedLink className={styles.lineBannerButton} href={settings.lineUrl} articleId={articleId} placement={placement}>
          {settings.lineLabel}
        </TrackedLink>
      </div>
    </section>
  );
}

export function MediaSidebar({
  popularArticles,
  recentArticles,
  settings,
  articleId,
  searchQuery = '',
}: {
  popularArticles: MediaArticleWithViews[];
  recentArticles: MediaArticle[];
  settings: MediaSettings;
  articleId?: string;
  searchQuery?: string;
}) {
  const accounts = [
    ['Instagram', settings.instagramAccountUrl],
    ['Threads', settings.threadsAccountUrl],
    ['YouTube', settings.youtubeAccountUrl],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  const embeddedPosts = settings.sidebarEmbedUrls.map((url, index) => ({
    id: `sidebar-embed-${index}-${url}`,
    type: 'embed' as const,
    provider: url.includes('instagram.com')
      ? 'instagram' as const
      : url.includes('threads.net') || url.includes('threads.com')
        ? 'threads' as const
        : 'youtube' as const,
    url,
    caption: '',
  }));
  const ranked = popularArticles.filter((article) => article.views > 0);
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarSearch}>
        <MediaSearchForm defaultValue={searchQuery} />
      </div>
      <MediaLineBanner settings={settings} articleId={articleId} placement="sidebar-line" />
      {ranked.length > 0 && (
        <section className={styles.sidebarCard} id="ranking">
          <h2 className={styles.sidebarHeading}>人気記事ランキング</h2>
          <div className={styles.ranking}>
            {ranked.map((article, index) => (
              <Link className={styles.rankingItem} href={mediaUrl(`/articles/${article.slug}`)} key={article.id}>
                <span className={styles.rank}>{index + 1}</span>
                <span className={styles.rankingTitle}>{article.title}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {recentArticles.length > 0 && (
        <section className={styles.sidebarCard}>
          <h2 className={styles.sidebarHeading}>新着記事</h2>
          <div className={styles.recentList}>
            {recentArticles.slice(0, 5).map((article) => (
              <Link className={styles.recentItem} href={mediaUrl(`/articles/${article.slug}`)} key={article.id}>
                <span className={styles.recentTitle}>{article.title}</span>
                <time dateTime={article.publishedAt || article.updatedAt}>{shortDate(article.publishedAt || article.updatedAt)}</time>
              </Link>
            ))}
          </div>
          <Link className={styles.sidebarMore} href={mediaUrl('/articles')}>記事一覧を見る</Link>
        </section>
      )}
      {embeddedPosts.length > 0 && (
        <section className={styles.sidebarCard}>
          <h2 className={styles.sidebarHeading}>最新のSNS投稿</h2>
          <ArticleRenderer blocks={embeddedPosts} articleId={articleId} compact />
        </section>
      )}
      {accounts.length > 0 && (
        <section className={styles.sidebarCard}>
          <h2 className={styles.sidebarHeading}>公式アカウント</h2>
          <div className={styles.accountLinks}>
            {accounts.map(([label, url]) => (
              <TrackedLink href={url} articleId={articleId} placement={`sidebar-${label.toLowerCase()}`} key={label} target="_blank" rel="noreferrer">
                <span>{label}</span><span aria-hidden="true">↗</span>
              </TrackedLink>
            ))}
          </div>
        </section>
      )}
      <section className={styles.analycaCard}>
        <h2>SNSの数字、手作業で集めていませんか</h2>
        <p>ANALYCAはInstagramとThreadsのインサイトを自動で取得し、ダッシュボードで一目で確認できます。</p>
        <TrackedLink className={styles.buttonGradient} href={ANALYCA_SIGNUP_URL} articleId={articleId} placement="sidebar-analyca">
          ANALYCAを無料で始める
        </TrackedLink>
      </section>
    </aside>
  );
}
