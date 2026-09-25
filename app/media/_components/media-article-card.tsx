import Image from 'next/image';
import Link from 'next/link';
import type { MediaArticle } from '@/lib/media/types';
import { mediaUrl } from '@/lib/media/site';
import styles from '../media.module.css';

function dateLabel(value: string | null): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeZone: 'Asia/Tokyo' }).format(new Date(value));
}

export function MediaArticleCard({ article }: { article: MediaArticle }) {
  return (
    <Link href={mediaUrl(`/articles/${article.slug}`)} className={styles.articleCard}>
      <div className={styles.thumb}>
        {article.coverImageUrl ? (
          <Image
            src={article.coverImageUrl}
            alt={article.coverImageAlt || ''}
            fill
            unoptimized
            sizes="(max-width: 620px) calc(100vw - 28px), 230px"
          />
        ) : (
          <div className={styles.thumbFallback}>ANALYCA</div>
        )}
      </div>
      <div>
        <div className={styles.tags}>
          {article.tags.slice(0, 3).map((tag) => <span className={styles.tag} key={tag}>{tag}</span>)}
        </div>
        <h2 className={styles.articleCardTitle}>{article.title}</h2>
        <p className={styles.articleCardDescription}>{article.description}</p>
      </div>
      <time className={styles.articleDate} dateTime={article.publishedAt || article.updatedAt}>
        {dateLabel(article.publishedAt || article.updatedAt)}
      </time>
    </Link>
  );
}
