import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveInstagramUsers,
  upsertInstagramInsights,
  InstagramInsights,
} from '@/lib/bigquery';
import { detectGraphBase } from '@/lib/instagram-graph';
import { v4 as uuidv4 } from 'uuid';
import { BigQuery } from '@google-cloud/bigquery';

// Vercel Functionの最大実行時間を延長
export const maxDuration = 300;

const bigquery = new BigQuery({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  projectId: 'mark-454114',
});

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
 * アカウントインサイトを取得（今日のtotal_value）
 */
async function getAccountInsights(graphBase: string, accessToken: string, accountId: string): Promise<AccountInsights> {
  const insights: AccountInsights = {};

  try {
    const response = await fetch(
      `${graphBase}/${accountId}/insights?metric=reach,profile_views,website_clicks,accounts_engaged&metric_type=total_value&period=day&access_token=${accessToken}`
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.warn(`Account insights API error (${response.status}):`, errBody);
      return insights;
    }

    const data = await response.json();

    if (data.data && Array.isArray(data.data)) {
      for (const metric of data.data) {
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
 * 過去の欠損日数を検出して日別insightsをバックフィル
 * period=day + since/until で最大30日分の日別reachデータを取得
 */
async function backfillMissingInsights(
  userId: string,
  graphBase: string,
  accessToken: string,
  accountId: string,
  currentFollowers: number
): Promise<number> {
  try {
    // BigQueryで最新のinsights日付を取得
    const [rows] = await bigquery.query({
      query: `SELECT MAX(date) as latest_date FROM \`mark-454114.analyca.instagram_insights\` WHERE user_id = @user_id`,
      params: { user_id: userId },
    });

    const latestDate = rows[0]?.latest_date;
    if (!latestDate) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastDate = new Date(latestDate.value || latestDate);
    lastDate.setHours(0, 0, 0, 0);

    // 欠損が1日以内なら不要
    const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 1) return 0;

    // period=dayで過去データを取得（最大30日）
    const sinceDate = new Date(lastDate);
    sinceDate.setDate(sinceDate.getDate() + 1);
    const since = Math.floor(sinceDate.getTime() / 1000);
    const until = Math.floor(today.getTime() / 1000);

    const response = await fetch(
      `${graphBase}/${accountId}/insights?metric=reach,profile_views,website_clicks&period=day&since=${since}&until=${until}&access_token=${accessToken}`
    );

    if (!response.ok) {
      console.warn(`Backfill insights API error: ${response.status}`);
      return 0;
    }

    const data = await response.json();
    if (!data.data || !Array.isArray(data.data)) return 0;

    // 日別メトリクスをマップに整理
    const dailyMap: Record<string, Record<string, number>> = {};
    for (const metric of data.data) {
      for (const v of metric.values || []) {
        const date = v.end_time?.substring(0, 10);
        if (!date) continue;
        if (!dailyMap[date]) dailyMap[date] = {};
        dailyMap[date][metric.name] = v.value || 0;
      }
    }

    // 今日は除外（syncUserInsightsで別途処理）
    const todayStr = today.toISOString().split('T')[0];
    delete dailyMap[todayStr];

    let backfilledCount = 0;
    for (const [date, metrics] of Object.entries(dailyMap)) {
      const insights: InstagramInsights = {
        id: uuidv4(),
        user_id: userId,
        date,
        followers_count: currentFollowers,
        posts_count: 0,
        reach: metrics.reach || 0,
        engagement: 0,
        profile_views: metrics.profile_views || 0,
        website_clicks: metrics.website_clicks || 0,
      };
      await upsertInstagramInsights(insights);
      backfilledCount++;
    }

    if (backfilledCount > 0) {
      console.log(`Backfilled ${backfilledCount} days of insights for user ${userId}`);
    }

    return backfilledCount;
  } catch (error) {
    console.error(`Error backfilling insights for user ${userId}:`, error);
    return 0;
  }
}

/**
 * ユーザーのインサイトデータを同期
 */
async function syncUserInsights(
  userId: string,
  accessToken: string,
  instagramUserId: string
): Promise<{ success: boolean; backfilledDays?: number; error?: string }> {
  try {
    const graphBase = await detectGraphBase(accessToken, `/${instagramUserId}?fields=id`);

    const account = await getInstagramBusinessAccount(graphBase, accessToken, instagramUserId);
    if (!account) {
      return { success: false, error: 'Instagram account not found' };
    }

    // 欠損日のバックフィル（今日の分の前に実行）
    const backfilledDays = await backfillMissingInsights(
      userId, graphBase, accessToken, instagramUserId, account.followers_count || 0
    );

    // 今日のインサイトを取得・保存
    const accountInsights = await getAccountInsights(graphBase, accessToken, instagramUserId);
    const today = new Date().toISOString().split('T')[0];

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

    await upsertInstagramInsights(insights);

    return { success: true, backfilledDays };
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
        user.instagram_user_id
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
