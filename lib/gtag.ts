export const GA_MEASUREMENT_ID = 'G-73LYB72FTL';

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

// ページビュー計測
export function pageview(url: string): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('config', GA_MEASUREMENT_ID, {
    page_path: url,
  });
}

// カスタムイベント送信
export function event(action: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', action, params);
}
