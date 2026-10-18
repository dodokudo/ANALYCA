import { NextRequest, NextResponse } from 'next/server';
import { GRANDPRIX_ENTRY_COOKIE, readGrandprixEntrySession } from '@/lib/threads-grandprix-entry-session';

export async function GET(request: NextRequest) {
  const receipt = request.cookies.get(GRANDPRIX_ENTRY_COOKIE)?.value;
  const session = readGrandprixEntrySession(receipt);
  if (!session || session.eventId !== '2026-autumn') return NextResponse.redirect(new URL('/threads-grandprix/autumn?connection=expired', request.url));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://analyca.jp';
  const url = new URL('https://threads.com/oauth/authorize');
  url.search = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_THREADS_APP_ID || '729490462757265',
    redirect_uri: `${appUrl}/api/auth/threads/callback`,
    scope: 'threads_basic,threads_content_publish,threads_manage_insights,threads_manage_replies,threads_read_replies,threads_profile_discovery,threads_keyword_search',
    response_type: 'code',
    state: `grandprix.${receipt}`,
  }).toString();
  return NextResponse.redirect(url);
}
