import { NextResponse, type NextRequest } from 'next/server';

const CANONICAL_HOST = 'analyca.jp';
const ALLOWED_HOSTS = new Set([CANONICAL_HOST, 'analyca.vercel.app']);

export function proxy(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase();

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

