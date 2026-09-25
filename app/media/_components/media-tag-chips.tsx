import Link from 'next/link';
import type { MediaArticle } from '@/lib/media/types';
import { mediaUrl } from '@/lib/media/site';
import styles from '../media.module.css';

// 公開記事に付いているタグを多い順に並べる。カテゴリーは固定しない
export function MediaTagChips({ articles, activeTag = '' }: { articles: MediaArticle[]; activeTag?: string }) {
  const counts = new Map<string, number>();
  for (const article of articles) {
    for (const tag of article.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  const tags = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([tag]) => tag);
  if (tags.length === 0) return null;
  return (
    <nav className={styles.tagChips} aria-label="タグで絞り込む">
      <div className={styles.tagChipsInner}>
        <Link href={mediaUrl('/')} className={activeTag ? undefined : styles.tagChipActive}>すべて</Link>
        {tags.map((tag) => (
          <Link
            href={mediaUrl(`/?tag=${encodeURIComponent(tag)}`)}
            className={activeTag === tag ? styles.tagChipActive : undefined}
            key={tag}
          >
            {tag}
          </Link>
        ))}
      </div>
    </nav>
  );
}
