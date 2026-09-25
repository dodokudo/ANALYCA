import { NextResponse, type NextRequest } from 'next/server';

const CANONICAL_HOST = 'analyca.jp';
const MEDIA_HOST = 'media.analyca.jp';
const ALLOWED_HOSTS = new Set([CANONICAL_HOST, 'analyca.vercel.app']);

export function proxy(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase();
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (host === MEDIA_HOST) {
    if (
      pathname.startsWith('/_next/')
      || pathname === '/favicon.ico'
      || pathname === '/favicon.svg'
      || pathname === '/apple-icon.png'
      || pathname.startsWith('/icon-')
    ) {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.protocol = 'https:';
    url.host = CANONICAL_HOST;
    url.port = '';
    url.pathname = pathname === '/' ? '/media'
      : pathname === '/media' || pathname.startsWith('/media/') ? pathname : `/media${pathname}`;
    return NextResponse.redirect(url, 308);
  }

  if (!host || ALLOWED_HOSTS.has(host) || host === 'localhost') {
    return NextResponse.next();
  }

  if (host === 'www.analyca.jp' || host.endsWith('.vercel.app')) {
    const url = request.nextUrl.clone();
    url.protocol = 'https:';
    url.host = CANONICAL_HOST;
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}
