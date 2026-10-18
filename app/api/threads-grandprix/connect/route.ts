import { NextRequest, NextResponse } from 'next/server';
import { GRANDPRIX_ENTRY_COOKIE, readGrandprixEntrySession } from '@/lib/threads-grandprix-entry-session';

import { GRANDPRIX_EVENTS, isGrandprixEntryOpen } from '@/lib/threads-grandprix-events';
import { createGrandprixLoginSession, GRANDPRIX_LOGIN_COOKIE, GRANDPRIX_LOGIN_MAX_AGE } from '@/lib/threads-grandprix-login-session';

export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get('event');
  const event = eventId ? GRANDPRIX_EVENTS.find(item => item.eventId === eventId) : null;
  if (eventId && (!event || !isGrandprixEntryOpen(event))) {
    return NextResponse.redirect(new URL('/login/threads?error=' + encodeURIComponent('この大会の受付期間は終了しています。'), request.url));
  }
  const loginReceipt = event ? createGrandprixLoginSession(event.eventId) : null;
  const receipt = request.cookies.get(GRANDPRIX_ENTRY_COOKIE)?.value;
  const session = readGrandprixEntrySession(receipt);
  if (!loginReceipt && (!session || session.eventId !== '2026-autumn')) return NextResponse.redirect(new URL('/threads-grandprix/autumn?connection=expired', request.url));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://analyca.jp';
  const url = new URL('https://threads.com/oauth/authorize');
  url.search = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_THREADS_APP_ID || '729490462757265',
    redirect_uri: `${appUrl}/api/auth/threads/callback`,
    scope: 'threads_basic,threads_content_publish,threads_manage_insights,threads_manage_replies,threads_read_replies,threads_profile_discovery,threads_keyword_search',
    response_type: 'code',
    state: loginReceipt ? `grandprix-login.${loginReceipt}` : `grandprix.${receipt}`,
  }).toString();
  const response = NextResponse.redirect(url);
  if (loginReceipt) response.cookies.set(GRANDPRIX_LOGIN_COOKIE, loginReceipt, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: GRANDPRIX_LOGIN_MAX_AGE,
  });
  return response;
}
