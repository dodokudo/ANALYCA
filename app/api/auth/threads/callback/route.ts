import { NextRequest, NextResponse } from 'next/server';
import { ThreadsAPI } from '@/lib/threads';
import {
  upsertThreadsUser,
  findUserIdByThreadsId,
} from '@/lib/bigquery';

export const maxDuration = 30;

const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || 'https://analyca.jp'}/api/auth/threads/callback`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code')?.replace(/#_$/, ''); // Threads adds #_ suffix
  const error = searchParams.get('error');
  const errorReason = searchParams.get('error_reason');

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

    // Step 4: Check for existing user (by Threads ID)
    const existingUserId = await findUserIdByThreadsId(account.id || threadsUserId);

    // Step 5: Save user (profile picture URLはCDNのまま保存、GCSアップロードはsyncで実行)
    const userId = await upsertThreadsUser({
      user_id: existingUserId || undefined,
      threads_user_id: account.id || threadsUserId,
      threads_username: account.username,
      threads_access_token: longToken,
      threads_token_expires_at: tokenExpiresAt,
      threads_profile_picture_url: account.threads_profile_picture_url || undefined,
    });

    // Step 6: 即座にダッシュボードへリダイレクト（syncing=trueでフルsync自動実行）
    return NextResponse.redirect(
      new URL(`/${userId}?tab=threads&auth=threads_complete&syncing=true`, request.url)
    );
  } catch (err) {
    console.error('Threads OAuth callback error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
