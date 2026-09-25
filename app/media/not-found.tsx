import Link from 'next/link';
import { mediaUrl } from '@/lib/media/site';
import styles from './media.module.css';

export default function MediaNotFound() {
  return (
    <main className={styles.articleGrid}>
      <section className={styles.empty}>
        <h1>記事が見つかりません</h1>
        <p>URLが変わったか、記事が非公開になった可能性があります。</p>
        <Link className={styles.buttonGradient} href={mediaUrl('/articles')}>記事一覧へ戻る</Link>
      </section>
    </main>
  );
}
