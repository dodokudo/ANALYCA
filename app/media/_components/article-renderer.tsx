import Image from 'next/image';
import Script from 'next/script';
import type { MediaContentBlock } from '@/lib/media/types';
import { TrackedLink } from './tracked-link';
import styles from '../media.module.css';

function youtubeId(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || '';
    if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/')[2] || '';
    return parsed.searchParams.get('v') || parsed.pathname.split('/embed/')[1]?.split('/')[0] || '';
  } catch {
    return '';
  }
}

export function ArticleRenderer({ blocks, articleId }: { blocks: MediaContentBlock[]; articleId?: string }) {
  const usesInstagram = blocks.some((block) => block.type === 'embed' && block.provider === 'instagram');
  const usesThreads = blocks.some((block) => block.type === 'embed' && block.provider === 'threads');
  return (
    <div className={styles.articleBody}>
      {blocks.map((block, index) => {
        const anchor = `section-${index + 1}`;
        if (block.type === 'heading') {
          return block.level === 3
            ? <h3 id={anchor} key={block.id}>{block.text}</h3>
            : <h2 id={anchor} key={block.id}>{block.text}</h2>;
        }
        if (block.type === 'paragraph') return <p key={block.id}>{block.text}</p>;
        if (block.type === 'list') return <ul key={block.id}>{block.items.map((item, itemIndex) => <li key={`${block.id}-${itemIndex}`}>{item}</li>)}</ul>;
        if (block.type === 'quote') {
          return <blockquote className={styles.quote} key={block.id}>{block.text}{block.source && <cite>{block.source}</cite>}</blockquote>;
        }
        if (block.type === 'image') {
          if (!block.url) return null;
          return (
            <figure className={styles.bodyImage} key={block.id}>
              <Image src={block.url} alt={block.alt} width={1200} height={675} unoptimized sizes="(max-width: 900px) calc(100vw - 28px), 760px" />
              {block.caption && <figcaption className={styles.caption}>{block.caption}</figcaption>}
            </figure>
          );
        }
        if (block.type === 'cta') {
          if (!block.url) return null;
          return (
            <section className={styles.cta} key={block.id}>
              <h3>{block.headline}</h3>
              {block.body && <p>{block.body}</p>}
              <TrackedLink
                className={styles.button}
                href={block.url}
                articleId={articleId}
                placement={block.placement || 'article-inline'}
              >
                {block.label || '詳しく見る'}
              </TrackedLink>
            </section>
          );
        }
        if (block.type === 'embed') {
          if (!block.url) return null;
          const videoId = block.provider === 'youtube' ? youtubeId(block.url) : '';
          return (
            <figure className={styles.embed} key={block.id}>
              {block.provider === 'youtube' && videoId ? (
                <div className={styles.videoFrame}>
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`}
                    title={block.caption || 'YouTube動画'}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              ) : block.provider === 'instagram' ? (
                <blockquote className="instagram-media" data-instgrm-permalink={block.url} data-instgrm-version="14">
                  <a href={block.url}>Instagramで投稿を見る</a>
                </blockquote>
              ) : block.provider === 'threads' ? (
                <blockquote className="text-post-media" data-text-post-permalink={block.url}>
                  <a href={block.url}>Threadsで投稿を見る</a>
                </blockquote>
              ) : (
                <a className={styles.socialFallback} href={block.url}>投稿を開く</a>
              )}
              {block.caption && <figcaption className={styles.caption}>{block.caption}</figcaption>}
            </figure>
          );
        }
        return null;
      })}
      {usesInstagram && <Script id="instagram-embed" src="https://www.instagram.com/embed.js" strategy="lazyOnload" />}
      {usesThreads && <Script id="threads-embed" src="https://www.threads.net/embed.js" strategy="lazyOnload" />}
    </div>
  );
}
