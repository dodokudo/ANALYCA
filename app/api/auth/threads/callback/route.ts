import { NextRequest, NextResponse } from 'next/server';
import { ThreadsAPI } from '@/lib/threads';
import {
  getUserById,
  upsertThreadsUser,
  findUserIdByThreadsId,
  updateLastLogin,
} from '@/lib/bigquery';
import { isChannelBlockedByPlan, resolveEffectivePlanId } from '@/lib/univapay/plans';

export const maxDuration = 300;

const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || 'https://analyca.jp'}/api/auth/threads/callback`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code')?.replace(/#_$/, ''); // Threads adds #_ suffix
  const error = searchParams.get('error');
  const errorReason = searchParams.get('error_reason');
  const stateParam = searchParams.get('state');

  // OAuth denied or error
  if (error) {
    console.error('Threads OAuth error:', error, errorReason);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorReason || error)}`, request.url)
    );
  }

  if (!code) {
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

    // Step 4: Check for existing user (by Threads ID or pending user from checkout)
    let pendingUserId: string | undefined;
    if (stateParam) {
      try {
        const state = JSON.parse(decodeURIComponent(stateParam));
        pendingUserId = state.pendingUserId;
      } catch { /* invalid state, ignore */ }
    }
    const existingUserId = pendingUserId || await findUserIdByThreadsId(account.id || threadsUserId);

    // 既存ユーザーが居る場合のみプラン制限チェック。居ない場合は新規ダッシュボードを作成する（決済は別フロー）
    if (existingUserId) {
      const existingUser = await getUserById(existingUserId);
      if (existingUser) {
        const effectivePlanId = resolveEffectivePlanId(existingUser.plan_id, {
          has_threads: existingUser.has_threads,
          has_instagram: existingUser.has_instagram,
        });
        if (isChannelBlockedByPlan(effectivePlanId, 'threads')) {
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
    const redirectUrl = new URL(`/${userId}?tab=threads&auth=threads_complete&syncing=true`, request.url);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set('analycaUserId', userId, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
    return response;
  } catch (err) {
    console.error('Threads OAuth callback error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
