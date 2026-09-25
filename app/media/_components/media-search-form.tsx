import { mediaUrl } from '@/lib/media/site';
import styles from '../media.module.css';

export function MediaSearchForm({ defaultValue = '' }: { defaultValue?: string }) {
  return (
    <form className={styles.searchForm} action={mediaUrl('/articles')} method="get" role="search">
      <input name="q" defaultValue={defaultValue} placeholder="記事を検索" aria-label="記事を検索" />
      <button type="submit">検索</button>
    </form>
  );
}
