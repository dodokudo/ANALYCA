import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import {
  getMediaSettings,
  getPopularMediaArticles,
  getPublicMediaArticleBySlug,
  listMediaArticles,
} from '@/lib/media/repository';
import { DEFAULT_MEDIA_SETTINGS } from '@/lib/media/types';
import { mediaUrl } from '@/lib/media/site';
import { ArticleRenderer } from '../../_components/article-renderer';
import { MediaArticleCard } from '../../_components/media-article-card';
import { MediaPageView } from '../../_components/tracking';
import { MediaSidebar } from '../../_components/media-sidebar';
import styles from '../../media.module.css';

export const dynamic = 'force-dynamic';

const articleBySlug = cache((slug: string) => getPublicMediaArticleBySlug(slug));

function dateLabel(value: string | null): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'long', timeZone: 'Asia/Tokyo' }).format(new Date(value));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await articleBySlug(slug).catch(() => null);
  if (!article) return { title: '記事が見つかりません', robots: { index: false, follow: false } };
  const url = mediaUrl(`/articles/${article.slug}`);
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.description,
      url,
      publishedTime: article.publishedAt || undefined,
      modifiedTime: article.updatedAt,
      authors: [article.authorName],
      tags: article.tags,
      images: article.coverImageUrl ? [{ url: article.coverImageUrl, alt: article.coverImageAlt }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.description,
      images: article.coverImageUrl ? [article.coverImageUrl] : undefined,
    },
  };
}

export default async function MediaArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await articleBySlug(slug).catch(() => null);
  if (!article) notFound();
  const [settings, popular, candidates] = await Promise.all([
    getMediaSettings().catch(() => DEFAULT_MEDIA_SETTINGS),
    getPopularMediaArticles(5).catch(() => []),
    listMediaArticles({ publicOnly: true, limit: 12 }).catch(() => []),
  ]);
  const related = candidates
    .filter((candidate) => candidate.id !== article.id && candidate.tags.some((tag) => article.tags.includes(tag)))
    .slice(0, 3);
  const recent = candidates.filter((candidate) => candidate.id !== article.id).slice(0, 5);
  const headings = article.blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => block.type === 'heading' && block.level === 2);
  const url = mediaUrl(`/articles/${article.slug}`);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    image: article.coverImageUrl || undefined,
    datePublished: article.publishedAt || article.updatedAt,
    dateModified: article.updatedAt,
    author: { '@type': 'Person', name: article.authorName },
    publisher: { '@type': 'Organization', name: 'ANALYCA', url: 'https://analyca.jp' },
    mainEntityOfPage: url,
  };
  return (
    <main className={styles.articleGrid}>
      <MediaPageView articleId={article.id} />
      <article>
        <div className={styles.breadcrumb}>
          <Link href={mediaUrl('/')}>トップ</Link> / 記事
        </div>
        <div className={styles.tags}>
          {article.tags.map((tag) => <Link className={styles.tag} href={mediaUrl(`/?tag=${encodeURIComponent(tag)}`)} key={tag}>{tag}</Link>)}
        </div>
        <h1 className={styles.articleTitle}>{article.title}</h1>
        <p className={styles.articleLead}>{article.description}</p>
        <div className={styles.byline}>
          <span>執筆：{article.authorName}</span>
          <time dateTime={article.publishedAt || article.updatedAt}>公開：{dateLabel(article.publishedAt || article.updatedAt)}</time>
          {article.publishedAt !== article.updatedAt && <time dateTime={article.updatedAt}>更新：{dateLabel(article.updatedAt)}</time>}
        </div>
        {article.coverImageUrl && (
          <div className={styles.cover}>
            <Image
              src={article.coverImageUrl}
              alt={article.coverImageAlt}
              fill
              priority
              unoptimized
              sizes="(max-width: 900px) calc(100vw - 28px), 760px"
            />
          </div>
        )}
        {headings.length > 0 && (
          <nav className={styles.toc} aria-label="目次">
            <strong>目次</strong>
            <ol>
              {headings.map(({ block, index }) => (
                <li key={block.id}><a href={`#section-${index + 1}`}>{'text' in block ? block.text : ''}</a></li>
              ))}
            </ol>
          </nav>
        )}
        <ArticleRenderer blocks={article.blocks} articleId={article.id} />
        {article.sources.length > 0 && (
          <section className={styles.sources}>
            <h2>参考情報</h2>
            <ol>
              {article.sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
                  {source.publisher && `（${source.publisher}）`}
                </li>
              ))}
            </ol>
          </section>
        )}
        <section className={styles.authorBox}>
          <h2>{article.authorName}</h2>
          <p>{article.authorBio || settings.authorBio}</p>
        </section>
        {related.length > 0 && (
          <section>
            <div className={styles.sectionHeader}><h2>関連記事</h2></div>
            <div className={styles.articleList}>{related.map((item) => <MediaArticleCard article={item} key={item.id} />)}</div>
          </section>
        )}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      </article>
      <MediaSidebar popularArticles={popular} recentArticles={recent} settings={settings} articleId={article.id} />
    </main>
  );
}
