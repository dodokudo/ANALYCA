export const MEDIA_ORIGIN = (process.env.NEXT_PUBLIC_MEDIA_URL || 'https://media.analyca.jp').replace(/\/$/, '');

export function mediaUrl(path = '/'): string {
  return `${MEDIA_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}
