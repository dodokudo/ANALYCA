// One public base URL for navigation, canonical metadata and the sitemap.
// media.analyca.jp redirects here in proxy.ts.
export const MEDIA_ORIGIN = 'https://analyca.jp/media';

export function mediaUrl(path = '/'): string {
  if (path === '/' || !path) return MEDIA_ORIGIN;
  if (path.startsWith('/?')) return `${MEDIA_ORIGIN}${path.slice(1)}`;
  return `${MEDIA_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}
