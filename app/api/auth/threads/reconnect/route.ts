import { NextRequest, NextResponse } from 'next/server';
import { getUserById } from '@/lib/bigquery';
import { createThreadsReauthSession, THREADS_REAUTH_COOKIE, THREADS_REAUTH_MAX_AGE } from '@/lib/threads-reauth-session';
import { isChannelBlockedByPlan, resolveEffectivePlanId } from '@/lib/univapay/plans';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  try {
    const user = await getUserById(userId);
    if (!user?.threads_user_id) return NextResponse.json({ error: 'Threads is not connected' }, { status: 404 });
    const plan = resolveEffectivePlanId(user.plan_id, { has_threads: user.has_threads, has_instagram: user.has_instagram });
    if (isChannelBlockedByPlan(plan, 'threads')) return NextResponse.redirect(new URL(`/${encodeURIComponent(userId)}?tab=threads`, request.url));
    const receipt = createThreadsReauthSession(userId, user.threads_user_id, request.nextUrl.searchParams.get('returnTo'));
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://analyca.jp';
    const url = new URL('https://threads.com/oauth/authorize');
    url.search = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_THREADS_APP_ID || '729490462757265',
      redirect_uri: `${appUrl}/api/auth/threads/callback`,
      scope: 'threads_basic,threads_content_publish,threads_manage_insights,threads_manage_replies,threads_read_replies,threads_profile_discovery,threads_keyword_search',
      response_type: 'code', state: `reauth.${receipt}`,
    }).toString();
    const response = NextResponse.redirect(url);
    response.headers.set('Cache-Control', 'private, no-store');
    response.cookies.set(THREADS_REAUTH_COOKIE, receipt, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: THREADS_REAUTH_MAX_AGE,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL(`/${encodeURIComponent(userId)}?tab=threads&reauth=error`, request.url));
  }
}
