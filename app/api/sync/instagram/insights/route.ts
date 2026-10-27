import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveInstagramUsers,
  upsertInstagramInsightBatch,
} from '@/lib/bigquery';
import { detectGraphBase } from '@/lib/instagram-graph';
import { syncAccountInsightDays } from '@/lib/instagram-insights-sync';

// Vercel Functionの最大実行時間を延長
export const maxDuration = 300;

interface InstagramUser {
  id: string;
  username: string;
  followers_count: number;
  media_count: number;
}

/**
 * Instagramビジネスアカウント情報を取得
 */
async function getInstagramBusinessAccount(graphBase: string, accessToken: string, instagramUserId: string): Promise<InstagramUser | null> {
  try {
    const response = await fetch(
      `${graphBase}/${instagramUserId}?fields=id,username,followers_count,media_count&access_token=${accessToken}`
    );

    if (!response.ok) {
      console.warn('Failed to get Instagram account info');
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching Instagram account:', error);
    return null;
  }
}

/**
 * ユーザーのインサイトデータを同期
 */
async function syncUserInsights(
  userId: string,
  accessToken: string,
  instagramUserId: string,
  range?: 'thisWeek',
): Promise<{ success: boolean; savedDays?: number; failedDates?: string[]; error?: string }> {
  try {
    const graphBase = await detectGraphBase(accessToken, `/${instagramUserId}?fields=id`);

    const account = await getInstagramBusinessAccount(graphBase, accessToken, instagramUserId);
    if (!account) {
      return { success: false, error: 'Instagram account not found' };
    }

    const result = await syncAccountInsightDays({
      graphBase,
      range,
      accountId: instagramUserId,
      accessToken,
      followers: account.followers_count,
      posts: account.media_count,
      save: rows => upsertInstagramInsightBatch(userId, rows),
    });
    return {
      ...result,
      ...(result.success ? {} : { error: result.apiErrors.join(' / ') || `Insights unavailable for ${result.failedDates.length} days` }),
    };
  } catch (error) {
    console.error(`Error syncing insights for user ${userId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * GET: インサイトを同期
 * - userId指定あり: そのユーザーのみ同期
 * - userId指定なし: ディスパッチャーモード（全ユーザーに個別HTTP fetch並列発行）
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    // ── 単一ユーザー同期モード ──
    if (targetUserId) {
      const users = await getActiveInstagramUsers();
      const user = users.find(u => u.user_id === targetUserId);

      if (!user) {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
      }

      if (!user.access_token || !user.instagram_user_id) {
        return NextResponse.json({ success: false, error: 'Missing access token or Instagram user ID' }, { status: 400 });
      }

      const result = await syncUserInsights(
        user.user_id,
        user.access_token,
        user.instagram_user_id,
        searchParams.get('period') === 'thisWeek' ? 'thisWeek' : undefined,
      );

      return NextResponse.json({
        success: result.success,
        userId: user.user_id,
        username: user.instagram_username,
        ...result,
      });
    }

    // ── ディスパッチャーモード（cron用） ──
    const users = await getActiveInstagramUsers();
    const validUsers = users.filter(u => u.access_token && u.instagram_user_id);

    if (validUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active Instagram users found',
        results: [],
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://analyca.jp';

    const syncPromises = validUsers.map(async (user) => {
      try {
        const res = await fetch(
          `${appUrl}/api/sync/instagram/insights?userId=${encodeURIComponent(user.user_id)}`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        return {
          userId: user.user_id,
          username: user.instagram_username,
          success: data.success ?? false,
          error: data.error,
        };
      } catch (err) {
        return {
          userId: user.user_id,
          username: user.instagram_username,
          success: false,
          error: err instanceof Error ? err.message : 'Dispatch failed',
        };
      }
    });

    const results = await Promise.all(syncPromises);
    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      message: `Dispatched sync for ${successCount}/${validUsers.length} users`,
      results,
    });
  } catch (error) {
    console.error('Instagram insights sync error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, accessToken, instagramUserId } = body;

    if (!userId || !accessToken || !instagramUserId) {
      return NextResponse.json({
        success: false,
        error: 'userId, accessToken, and instagramUserId are required',
      }, { status: 400 });
    }

    const result = await syncUserInsights(userId, accessToken, instagramUserId);

    return NextResponse.json({
      success: result.success,
      error: result.error,
    });
  } catch (error) {
    console.error('Instagram insights sync error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    }, { status: 500 });
  }
}
