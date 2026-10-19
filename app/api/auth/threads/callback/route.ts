import { after, NextRequest, NextResponse } from 'next/server';
import { GRANDPRIX_ENTRY_COOKIE, readGrandprixEntrySession } from '@/lib/threads-grandprix-entry-session';
import {
  configuredMediaAdminIds,
  createMediaAdminSession,
  MEDIA_ADMIN_SESSION_COOKIE,
} from '@/lib/media/auth';
import { ThreadsAPI } from '@/lib/threads';
import {
  getUserById,
  upsertThreadsUser,
  findUserIdByThreadsId,
  updateLastLogin,
} from '@/lib/bigquery';
import { isChannelBlockedByPlan, resolveEffectivePlanId } from '@/lib/univapay/plans';

import { GRANDPRIX_LOGIN_COOKIE, readGrandprixLoginSession } from '@/lib/threads-grandprix-login-session';
import { GRANDPRIX_EVENTS, isGrandprixEntryOpen } from '@/lib/threads-grandprix-events';

export const maxDuration = 300;

const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || 'https://analyca.jp'}/api/auth/threads/callback`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code')?.replace(/#_$/, ''); // Threads adds #_ suffix
  const error = searchParams.get('error');
  const errorReason = searchParams.get('error_reason');
  const stateParam = searchParams.get('state');
  const entryReceipt = request.cookies.get(GRANDPRIX_ENTRY_COOKIE)?.value;
  const isGrandprix = stateParam?.startsWith('grandprix.') === true;
  const grandprixSession = isGrandprix && stateParam === `grandprix.${entryReceipt}` ? readGrandprixEntrySession(entryReceipt) : null;
  if (isGrandprix && (!grandprixSession || grandprixSession.eventId !== '2026-autumn')) {
    return NextResponse.redirect(new URL('/threads-grandprix/autumn?connection=expired', request.url));
  }

  const isGrandprixLogin = stateParam?.startsWith('grandprix-login.') === true;
  const loginReceipt = request.cookies.get(GRANDPRIX_LOGIN_COOKIE)?.value;
  const loginSession = isGrandprixLogin && stateParam === `grandprix-login.${loginReceipt}` ? readGrandprixLoginSession(loginReceipt) : null;
  const loginEvent = loginSession ? GRANDPRIX_EVENTS.find(event => event.eventId === loginSession.eventId) : null;
  const loginError = (message: string) => {
    const url = new URL('/login/threads', request.url);
    if (loginSession) url.searchParams.set('grandprix', loginSession.eventId);
    url.searchParams.set('error', message);
    return NextResponse.redirect(url);
  };
  if (isGrandprixLogin && (!loginSession || !loginEvent || !isGrandprixEntryOpen(loginEvent))) {
    return loginError('ログインをやり直してください。メールのリンクから再度お進みください。');
  }

  // OAuth denied or error
  if (error) {
    if (isGrandprixLogin) return loginError('接続が完了していません。必要な権限を許可して再度ログインしてください。');
    if (isGrandprix) return NextResponse.redirect(new URL('/threads-grandprix/autumn?connection=denied', request.url));
    console.error('Threads OAuth error:', error, errorReason);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorReason || error)}`, request.url)
    );
  }

  if (!code) {
    if (isGrandprixLogin) return loginError('ログインを完了できませんでした。もう一度お試しください。');
    if (isGrandprix) return NextResponse.redirect(new URL('/threads-grandprix/autumn?connection=error', request.url));
    return NextResponse.redirect(
      new URL('/login?error=no_code', request.url)
    );
  }

  try {
    // Step 1: Exchange authorization code for short-lived token
    const { access_token: shortToken, user_id: threadsUserId } =
      await ThreadsAPI.exchangeCodeForShortToken(code, REDIRECT_URI);

    // Step 2: Exchange short-lived token for long-lived token (60 days)
    const longToken = await ThreadsAPI.exchangeForLongTermToken(shortToken);
    const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    // Step 3: Get account info (username + profile picture URL)
    const threads = new ThreadsAPI(longToken);
    const account = await threads.getAccountInfo();
    // 申込IDの入力違いでも本人が認証したアカウントを保存する。
    // エントリーとの照合・修正は管理画面で行い、ここでは自動登録・付け替えしない。

    // Step 4: Check for existing user (by Threads ID or pending user from checkout)
    let pendingUserId: string | undefined;
    if (stateParam) {
      try {
        const state = JSON.parse(decodeURIComponent(stateParam));
        pendingUserId = state.pendingUserId;
      } catch { /* invalid state, ignore */ }
    }
    const existingUserId = pendingUserId || await findUserIdByThreadsId(account.id || threadsUserId);

    // 無料配布用ログインでは新規ダッシュボードを作成する。
    // 既存ユーザーだけ、契約済みプランの媒体制限を確認する。
    if (existingUserId) {
      const existingUser = await getUserById(existingUserId);
      if (existingUser) {
        const effectivePlanId = resolveEffectivePlanId(existingUser.plan_id, {
          has_threads: existingUser.has_threads,
          has_instagram: existingUser.has_instagram,
        });
        if (isChannelBlockedByPlan(effectivePlanId, 'threads')) {
          if (loginSession) return loginError('現在のプランではThreadsを接続できません。運営にお問い合わせください。');
          if (grandprixSession) return NextResponse.redirect(new URL('/threads-grandprix/autumn?connection=plan_required', request.url));
          return NextResponse.redirect(new URL(`/${existingUserId}?tab=threads`, request.url));
        }
      }
    }

    // Step 5: Save user (profile picture URLはCDNのまま保存、GCSアップロードはsyncで実行)
    const userId = await upsertThreadsUser({
      user_id: existingUserId || undefined,
      threads_user_id: account.id || threadsUserId,
      threads_username: account.username,
      threads_access_token: longToken,
      threads_token_expires_at: tokenExpiresAt,
      threads_profile_picture_url: account.threads_profile_picture_url || undefined,
    });

    // Step 6: 最終ログイン日時を更新
    await updateLastLogin(userId, {
      accessPath: '/api/auth/threads/callback',
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(err => console.error('Failed to update last_login_at:', err));

    // Step 7: 即座にダッシュボードへリダイレクト（syncing=trueでフルsync自動実行）
    // Cookieで userId を渡す（ダッシュボード側でlocalStorageに保存）
    const redirectUrl = new URL(grandprixSession
      ? '/threads-grandprix/autumn?connection=complete#entry-form'
      : `/${userId}?tab=threads&auth=threads_complete&syncing=true`, request.url);
    if (grandprixSession) {
      // ダッシュボードに立ち寄らない参加者も、接続直後に初回データ取得を開始する。
      after(async () => {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://analyca.jp';
        await Promise.allSettled(['posts', 'insights'].map((type) =>
          fetch(`${appUrl}/api/sync/threads/${type}?userId=${encodeURIComponent(userId)}`, { cache: 'no-store' })
        ));
      });
    }
    const response = NextResponse.redirect(redirectUrl);
    if (loginSession) response.cookies.delete(GRANDPRIX_LOGIN_COOKIE);
    response.cookies.set('analycaUserId', userId, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
    if (configuredMediaAdminIds().has(userId)) {
      const mediaSession = createMediaAdminSession(userId);
      response.cookies.set(MEDIA_ADMIN_SESSION_COOKIE, mediaSession.value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: mediaSession.maxAge,
      });
    }
    return response;
  } catch (err) {
    console.error('Threads OAuth callback error:', err);
    if (isGrandprixLogin) return loginError('接続を完了できませんでした。もう一度お試しください。');
    if (isGrandprix) return NextResponse.redirect(new URL('/threads-grandprix/autumn?connection=error', request.url));
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
