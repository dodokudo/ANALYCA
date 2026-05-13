import { NextResponse } from 'next/server';
import { refreshInstagramLoginToken } from '@/lib/instagram-graph';
import {
  getInstagramUsersNeedingTokenRefresh,
  upsertUser,
} from '@/lib/bigquery';

export const maxDuration = 300;

/**
 * GET: Instagram(Facebook Graph)トークンの自動更新（cron用）
 * Facebook長期トークンは fb_exchange_token に既存の長期トークンを渡すと
 * 新しい60日トークンが返ってくる仕様。期限7日以内のユーザーを対象に再交換。
 */
export async function GET() {
  try {
    const users = await getInstagramUsersNeedingTokenRefresh();

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
      if (!user.access_token) {
        results.push({
          userId: user.user_id,
          username: user.instagram_username ?? null,
          success: false,
          error: 'Missing access token',
        });
        continue;
      }

      try {
        const refreshed = await refreshInstagramLoginToken(user.access_token);
        const newExpiresAt = new Date(Date.now() + (refreshed.expires_in || 60 * 24 * 60 * 60) * 1000);

        await upsertUser({
          user_id: user.user_id,
          instagram_user_id: user.instagram_user_id,
          instagram_username: user.instagram_username,
          instagram_profile_picture_url: user.instagram_profile_picture_url,
          access_token: refreshed.access_token,
          token_expires_at: newExpiresAt,
          drive_folder_id: user.drive_folder_id,
          has_instagram: true,
        });

        console.log(`IG token refreshed for ${user.instagram_username} (${user.user_id})`);
        results.push({
          userId: user.user_id,
          username: user.instagram_username ?? null,
          success: true,
        });
      } catch (error) {
        console.error(`Failed to refresh IG token for user ${user.user_id}:`, error);
        results.push({
          userId: user.user_id,
          username: user.instagram_username ?? null,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

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
    console.error('Instagram token refresh cron error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Token refresh failed',
    }, { status: 500 });
  }
}
