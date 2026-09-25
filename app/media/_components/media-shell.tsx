import Link from 'next/link';
import type { ReactNode } from 'react';
import type { MediaSettings } from '@/lib/media/types';
import { ANALYCA_SIGNUP_URL, mediaUrl } from '@/lib/media/site';
import { MediaSearchForm } from './media-search-form';
import { TrackedLink } from './tracked-link';
import styles from '../media.module.css';

// ANALYCA本体（components/AnalycaLogo.tsx）と同じアイコン
export function AnalycaMark({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? styles.brandMarkSmall : styles.brandMark} aria-hidden="true">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    </span>
  );
}

const NAV_ITEMS = [
  { label: '新着記事', href: mediaUrl('/') },
  { label: '人気記事', href: mediaUrl('/#ranking') },
  { label: '記事一覧', href: mediaUrl('/articles') },
];

export function MediaShell({ children, settings }: { children: ReactNode; settings: MediaSettings }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href={mediaUrl('/')} className={styles.brand} aria-label={`${settings.siteName} トップ`}>
            <AnalycaMark />
            <span className={styles.brandName}>ANALYCA</span>
            <span className={styles.brandLabel}>Media</span>
          </Link>
          <nav className={styles.nav} aria-label="メインナビゲーション">
            {NAV_ITEMS.map((item) => <Link href={item.href} key={item.label}>{item.label}</Link>)}
            <a href="https://analyca.jp">ANALYCAとは</a>
          </nav>
          <div className={styles.headerActions}>
            <TrackedLink className={styles.buttonOutline} href={ANALYCA_SIGNUP_URL} placement="header-analyca">
              ANALYCAを無料で始める
            </TrackedLink>
            {settings.lineUrl && (
              <TrackedLink className={styles.buttonLine} href={settings.lineUrl} placement="header-line">
                LINEで特典を受け取る
              </TrackedLink>
            )}
          </div>
          <details className={styles.mobileMenu}>
            <summary aria-label="メニューを開く">
              <span className={styles.mobileMenuSearch}>検索</span>
              <span className={styles.burger} aria-hidden="true"><i /><i /><i /></span>
            </summary>
            <div className={styles.mobileMenuPanel}>
              <MediaSearchForm />
              <nav aria-label="メニュー">
                {NAV_ITEMS.map((item) => <Link href={item.href} key={item.label}>{item.label}</Link>)}
                <a href="https://analyca.jp">ANALYCAとは</a>
              </nav>
            </div>
          </details>
        </div>
      </header>
      {children}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <AnalycaMark small />
            <div>
              <strong>{settings.siteName}</strong>
              <p>{settings.footerText}</p>
            </div>
          </div>
          <div className={styles.footerLinks}>
            <Link href={mediaUrl('/articles')}>記事一覧</Link>
            <a href="https://analyca.jp">ANALYCA</a>
            <span>© {new Date().getFullYear()} ANALYCA</span>
          </div>
        </div>
      </footer>
      <div className={styles.mobileBar}>
        {settings.lineUrl && (
          <TrackedLink className={styles.buttonLine} href={settings.lineUrl} placement="mobile-bar-line">
            LINEで特典を受け取る
          </TrackedLink>
        )}
        <TrackedLink className={styles.buttonGradient} href={ANALYCA_SIGNUP_URL} placement="mobile-bar-analyca">
          無料で始める
        </TrackedLink>
      </div>
    </div>
  );
}
