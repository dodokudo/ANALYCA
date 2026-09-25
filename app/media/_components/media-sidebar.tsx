import Image from 'next/image';
import Link from 'next/link';
import type { MediaArticleWithViews, MediaSettings } from '@/lib/media/types';
import { mediaUrl } from '@/lib/media/site';
import { TrackedLink } from './tracked-link';
import { ArticleRenderer } from './article-renderer';
import styles from '../media.module.css';

export function MediaSidebar({
  articles,
  settings,
  articleId,
}: {
  articles: MediaArticleWithViews[];
  settings: MediaSettings;
  articleId?: string;
}) {
  const accounts = [
    ['Instagram', settings.instagramAccountUrl],
    ['YouTube', settings.youtubeAccountUrl],
    ['Threads', settings.threadsAccountUrl],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  const embeddedPosts = settings.sidebarEmbedUrls.map((url, index) => ({
    id: `sidebar-embed-${index}-${url}`,
    type: 'embed' as const,
    provider: url.includes('instagram.com') ? 'instagram' as const : url.includes('threads.net') ? 'threads' as const : 'youtube' as const,
    url,
    caption: '',
  }));
  return (
    <aside className={styles.sidebar}>
      {articles.length > 0 && (
        <section className={styles.sidebarSection}>
          <h2>よく読まれている記事</h2>
          <div className={styles.ranking}>
            {articles.map((article, index) => (
              <Link className={styles.rankingItem} href={mediaUrl(`/articles/${article.slug}`)} key={article.id}>
                <span className={styles.rank}>{index + 1}</span>
                <span className={styles.rankingTitle}>{article.title}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {settings.lineUrl && (
        <section className={styles.lineBanner}>
          {settings.lineBannerImageUrl && (
            <div className={styles.lineBannerImage}>
              <Image src={settings.lineBannerImageUrl} alt="" fill unoptimized sizes="310px" />
            </div>
          )}
          <div className={styles.lineBannerBody}>
            <h2>{settings.lineHeadline}</h2>
            <p>{settings.lineBody}</p>
            <TrackedLink className={styles.button} href={settings.lineUrl} articleId={articleId} placement="sidebar-line">
              {settings.lineLabel}
            </TrackedLink>
          </div>
        </section>
      )}
      {accounts.length > 0 && (
        <section className={styles.sidebarSection}>
          <h2>公式アカウント</h2>
          <div className={styles.accountLinks}>
            {accounts.map(([label, url]) => (
              <TrackedLink href={url} articleId={articleId} placement={`sidebar-${label.toLowerCase()}`} key={label}>
                <span>{label}</span><span aria-hidden="true">↗</span>
              </TrackedLink>
            ))}
          </div>
        </section>
      )}
      {embeddedPosts.length > 0 && (
        <section className={styles.sidebarSection}>
          <h2>注目の投稿</h2>
          <ArticleRenderer blocks={embeddedPosts} articleId={articleId} />
        </section>
      )}
    </aside>
  );
}
