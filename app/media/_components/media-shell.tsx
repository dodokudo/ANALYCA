import Link from 'next/link';
import type { ReactNode } from 'react';
import type { MediaSettings } from '@/lib/media/types';
import { mediaUrl } from '@/lib/media/site';
import styles from '../media.module.css';

export function MediaShell({ children, settings }: { children: ReactNode; settings: MediaSettings }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href={mediaUrl('/')} className={styles.brand} aria-label={`${settings.siteName} トップ`}>
            <span className={styles.brandMark} aria-hidden="true" />
            <span>{settings.siteName}</span>
            <span className={styles.brandSub}>by ANALYCA</span>
          </Link>
          <nav className={styles.nav} aria-label="メインナビゲーション">
            <Link href={mediaUrl('/')}>新着記事</Link>
            <Link href={mediaUrl('/articles')}>記事一覧</Link>
            <a href="https://analyca.jp">ANALYCA</a>
          </nav>
        </div>
      </header>
      {children}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div>
            <strong>{settings.siteName}</strong>
            <p>{settings.footerText}</p>
          </div>
          <div>© {new Date().getFullYear()} ANALYCA</div>
        </div>
      </footer>
    </div>
  );
}
