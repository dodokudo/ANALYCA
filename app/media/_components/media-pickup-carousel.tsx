'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaArticle } from '@/lib/media/types';
import { mediaUrl } from '@/lib/media/site';
import styles from '../media.module.css';

const INTERVAL_MS = 5000;

function dateLabel(article: MediaArticle): string {
  return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeZone: 'Asia/Tokyo' })
    .format(new Date(article.publishedAt || article.updatedAt));
}

export function MediaPickupCarousel({ articles }: { articles: MediaArticle[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const count = articles.length;

  const go = useCallback((next: number) => {
    setIndex(((next % count) + count) % count);
  }, [count]);

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setTimeout(() => go(index + 1), INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [count, paused, index, go]);

  if (count === 0) return null;

  return (
    <div
      className={styles.carousel}
      aria-roledescription="カルーセル"
      aria-label="ピックアップ記事"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(event) => { touchStartX.current = event.touches[0].clientX; setPaused(true); }}
      onTouchEnd={(event) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        setPaused(false);
        if (start === null) return;
        const delta = event.changedTouches[0].clientX - start;
        if (Math.abs(delta) > 40) go(index + (delta < 0 ? 1 : -1));
      }}
    >
      <div className={styles.carouselViewport}>
        <div className={styles.carouselTrack} style={{ transform: `translateX(-${index * 100}%)` }}>
          {articles.map((article, slideIndex) => (
            <Link
              href={mediaUrl(`/articles/${article.slug}`)}
              className={styles.carouselSlide}
              key={article.id}
              aria-roledescription="スライド"
              aria-label={`${slideIndex + 1} / ${count}`}
              aria-hidden={slideIndex !== index}
              tabIndex={slideIndex === index ? 0 : -1}
            >
              <div className={styles.carouselThumb}>
                {article.coverImageUrl ? (
                  <Image
                    src={article.coverImageUrl}
                    alt={article.coverImageAlt || ''}
                    fill
                    unoptimized
                    priority={slideIndex === 0}
                    sizes="(max-width: 760px) calc(100vw - 32px), 640px"
                  />
                ) : (
                  <div className={styles.thumbFallback}>
                    <span>{article.tags[0] || 'ANALYCA'}</span>
                    <small>ANALYCA MEDIA</small>
                  </div>
                )}
              </div>
              <div className={styles.carouselBody}>
                <div className={styles.tags}>
                  <span className={styles.tagStrong}>ピックアップ</span>
                  {article.tags.slice(0, 2).map((tag) => <span className={styles.tag} key={tag}>{tag}</span>)}
                </div>
                <h2 className={styles.carouselTitle}>{article.title}</h2>
                <p className={styles.carouselDescription}>{article.description}</p>
                <time className={styles.articleDate} dateTime={article.publishedAt || article.updatedAt}>{dateLabel(article)}</time>
              </div>
            </Link>
          ))}
        </div>
      </div>
      {count > 1 && (
        <>
          <button type="button" className={`${styles.carouselArrow} ${styles.carouselPrev}`} onClick={() => go(index - 1)} aria-label="前の記事">
            <span aria-hidden="true">‹</span>
          </button>
          <button type="button" className={`${styles.carouselArrow} ${styles.carouselNext}`} onClick={() => go(index + 1)} aria-label="次の記事">
            <span aria-hidden="true">›</span>
          </button>
          <div className={styles.carouselDots}>
            {articles.map((article, dotIndex) => (
              <button
                type="button"
                key={article.id}
                className={dotIndex === index ? styles.carouselDotActive : styles.carouselDot}
                onClick={() => go(dotIndex)}
                aria-label={`${dotIndex + 1}件目を表示`}
                aria-current={dotIndex === index}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
