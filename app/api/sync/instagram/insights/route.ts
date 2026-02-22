import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveInstagramUsers,
  upsertInstagramInsights,
  InstagramInsights,
} from '@/lib/bigquery';
import { v4 as uuidv4 } from 'uuid';

// Vercel Functionの最大実行時間を延長
export const maxDuration = 60;

const INSTAGRAM_GRAPH_BASE = 'https://graph.instagram.com/v23.0';

interface InstagramUser {
  id: string;
  username: string;
  followers_count: number;
  media_count: number;
}

interface AccountInsights {
  reach?: number;
  profile_views?: number;
  website_clicks?: number;
  accounts_engaged?: number;
}

/**
 * Instagramビジネスアカウント情報を取得
 */
async function getInstagramBusinessAccount(accessToken: string, instagramUserId: string): Promise<InstagramUser | null> {
  try {
    const response = await fetch(
      `${INSTAGRAM_GRAPH_BASE}/${instagramUserId}?fields=id,username,followers_count,media_count&access_token=${accessToken}`
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
 * アカウントインサイトを取得（過去1日）
 * Graph API v23.0ではmetric_type=total_valueが必須
 */
async function getAccountInsights(accessToken: string, accountId: string): Promise<AccountInsights> {
  const insights: AccountInsights = {};

  try {
    // metric_type=total_value で全メトリクスを一括取得
    const response = await fetch(
      `${INSTAGRAM_GRAPH_BASE}/${accountId}/insights?metric=reach,profile_views,website_clicks,accounts_engaged&metric_type=total_value&period=day&access_token=${accessToken}`
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.warn(`Account insights API error (${response.status}):`, errBody);
      return insights;
    }

    const data = await response.json();

    if (data.data && Array.isArray(data.data)) {
      for (const metric of data.data) {
        // total_value形式のレスポンスを解析
        const value = metric.total_value?.value ?? metric.values?.[metric.values.length - 1]?.value ?? 0;

        switch (metric.name) {
          case 'reach':
            insights.reach = value || 0;
            break;
          case 'profile_views':
            insights.profile_views = value || 0;
            break;
          case 'website_clicks':
            insights.website_clicks = value || 0;
            break;
          case 'accounts_engaged':
            insights.accounts_engaged = value || 0;
            break;
        }
      }
    }

    return insights;
  } catch (error) {
    console.error(`Error fetching account insights for ${accountId}:`, error);
    return insights;
  }
}

/**
 * ユーザーのインサイトデータを同期
 */
async function syncUserInsights(
  userId: string,
  accessToken: string,
  instagramUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Instagramアカウント情報を取得
    const account = await getInstagramBusinessAccount(accessToken, instagramUserId);

    if (!account) {
      return { success: false, error: 'Instagram account not found' };
    }

    // アカウントインサイトを取得
    const accountInsights = await getAccountInsights(accessToken, instagramUserId);

    // 今日の日付
    const today = new Date().toISOString().split('T')[0];

    // インサイトデータを作成
    const insights: InstagramInsights = {
      id: uuidv4(),
      user_id: userId,
      date: today,
      followers_count: account.followers_count || 0,
      posts_count: account.media_count || 0,
      reach: accountInsights.reach || 0,
      engagement: accountInsights.accounts_engaged || 0,
      profile_views: accountInsights.profile_views || 0,
      website_clicks: accountInsights.website_clicks || 0,
    };

    // BigQueryに保存
    await upsertInstagramInsights(insights);

    return { success: true };
  } catch (error) {
    console.error(`Error syncing insights for user ${userId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * GET: 全アクティブユーザーのインサイトを同期
 * POST: 特定ユーザーのインサイトを同期
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    // アクティブなInstagramユーザーを取得
    let users = await getActiveInstagramUsers();

    // userIdが指定されている場合、そのユーザーのみに絞る
    if (targetUserId) {
      users = users.filter(u => u.user_id === targetUserId);
    }

    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active Instagram users found',
        results: [],
      });
    }

    const results: Array<{
      userId: string;
      username: string | null;
      success: boolean;
      error?: string;
    }> = [];

    // 各ユーザーのインサイトを同期
    for (const user of users) {
      if (!user.access_token || !user.instagram_user_id) {
        results.push({
          userId: user.user_id,
          username: user.instagram_username,
          success: false,
          error: 'Missing access token or Instagram user ID',
        });
        continue;
      }

      const result = await syncUserInsights(
        user.user_id,
        user.access_token,
        user.instagram_user_id
      );

      results.push({
        userId: user.user_id,
        username: user.instagram_username,
        ...result,
      });

      // API制限を考慮して少し待つ
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      message: `Synced insights for ${successCount}/${users.length} users`,
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
