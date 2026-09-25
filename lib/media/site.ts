// One public base URL for navigation, canonical metadata and the sitemap.
// media.analyca.jp redirects here in proxy.ts.
export const MEDIA_ORIGIN = 'https://analyca.jp/media';

// LPの「無料で始める」と同じ行き先
export const ANALYCA_SIGNUP_URL = 'https://analyca.jp/pricing';

export function mediaUrl(path = '/'): string {
  if (path === '/' || !path) return MEDIA_ORIGIN;
  if (path.startsWith('/?')) return `${MEDIA_ORIGIN}${path.slice(1)}`;
  return `${MEDIA_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}
