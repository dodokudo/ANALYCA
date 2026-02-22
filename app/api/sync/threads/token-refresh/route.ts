import { NextResponse } from 'next/server';
import { ThreadsAPI } from '@/lib/threads';
import {
  getThreadsUsersNeedingTokenRefresh,
  upsertThreadsUser,
} from '@/lib/bigquery';

// Vercel Functionの最大実行時間を延長
export const maxDuration = 60;

/**
 * GET: Threadsトークンの自動更新（cron用）
 * 有効期限が7日以内のユーザーのトークンを自動で更新する
 * 期限切れ前にリフレッシュすることで、ユーザーの再認証を不要にする
 */
export async function GET() {
  try {
    const users = await getThreadsUsersNeedingTokenRefresh();

    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No tokens need refreshing',
        refreshed: 0,
        results: [],
      });
    }

    const results: Array<{
      userId: string;
      username: string | null;
      success: boolean;
      error?: string;
    }> = [];

    for (const user of users) {
      if (!user.threads_access_token || !user.threads_user_id) {
        results.push({
          userId: user.user_id,
          username: user.threads_username ?? null,
          success: false,
          error: 'Missing access token or Threads user ID',
        });
        continue;
      }

      try {
        // トークンをリフレッシュ（新しい60日間のトークンが返る）
        const newToken = await ThreadsAPI.refreshLongTermToken(user.threads_access_token);
        const newExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60日後

        // BigQueryのユーザーレコードを更新
        await upsertThreadsUser({
          user_id: user.user_id,
          threads_user_id: user.threads_user_id,
          threads_username: user.threads_username || '',
          threads_access_token: newToken,
          threads_token_expires_at: newExpiresAt,
        });

        console.log(`Token refreshed for user ${user.threads_username} (${user.user_id})`);
        results.push({
          userId: user.user_id,
          username: user.threads_username ?? null,
          success: true,
        });
      } catch (error) {
        console.error(`Failed to refresh token for user ${user.user_id}:`, error);
        results.push({
          userId: user.user_id,
          username: user.threads_username ?? null,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // API制限を考慮
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      message: `Refreshed ${successCount}/${users.length} tokens`,
      refreshed: successCount,
      failed: users.length - successCount,
      results,
    });
  } catch (error) {
    console.error('Token refresh cron error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Token refresh failed',
    }, { status: 500 });
  }
}
