import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveThreadsUsers,
  upsertThreadsDailyMetrics,
  getUserThreadsDailyMetrics,
  getUserThreadsPosts,
} from '@/lib/bigquery';
import { v4 as uuidv4 } from 'uuid';

// Vercel Functionの最大実行時間を延長
export const maxDuration = 60;

const GRAPH_BASE = 'https://graph.threads.net/v1.0';

interface ThreadsUserInsights {
  followers_count?: number;
}

/**
 * Threadsユーザーのフォロワー数を取得
 */
async function getThreadsUserInsights(accessToken: string, threadsUserId: string): Promise<ThreadsUserInsights> {
  try {
    const response = await fetch(
      `${GRAPH_BASE}/${threadsUserId}/threads_insights?metric=followers_count&access_token=${accessToken}`
    );

    if (!response.ok) {
      console.warn('Failed to get Threads user insights');
      return {};
    }

    const data = await response.json();
    const insights: ThreadsUserInsights = {};

    if (data.data && Array.isArray(data.data)) {
      for (const metric of data.data) {
        if (metric.name === 'followers_count') {
          insights.followers_count = metric.total_value?.value || 0;
        }
      }
    }

    return insights;
  } catch {
    return {};
  }
}

/**
 * ユーザーのThreadsインサイトを同期
 */
async function syncUserInsights(
  userId: string,
  accessToken: string,
  threadsUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // フォロワー数を取得
    const userInsights = await getThreadsUserInsights(accessToken, threadsUserId);
    const followersCount = userInsights.followers_count || 0;

    // 今日の日付
    const today = new Date().toISOString().split('T')[0];

    // 前日のフォロワー数を取得してフォロワー増減を計算
    let followerDelta = 0;
    try {
      const previousMetrics = await getUserThreadsDailyMetrics(userId, 2);
      if (previousMetrics.length > 0) {
        const yesterday = previousMetrics.find(m => m.date !== today);
        if (yesterday) {
          followerDelta = followersCount - yesterday.followers_count;
        }
      }
    } catch {
      // エラー時は0
    }

    // 今日の投稿統計を計算（既存の投稿データから）
    let totalViews = 0;
    let totalLikes = 0;
    let totalReplies = 0;
    let todayPostCount = 0;

    try {
      const posts = await getUserThreadsPosts(userId, 100);

      // 全投稿の統計を集計
      totalViews = posts.reduce((sum, post) => sum + post.views, 0);
      totalLikes = posts.reduce((sum, post) => sum + post.likes, 0);
      totalReplies = posts.reduce((sum, post) => sum + post.replies, 0);

      // 今日投稿された数
      todayPostCount = posts.filter(post => {
        const postDate = post.timestamp.toISOString().split('T')[0];
        return postDate === today;
      }).length;
    } catch {
      // 投稿データがない場合は0
    }

    // 日別メトリクスを保存
    await upsertThreadsDailyMetrics({
      id: uuidv4(),
      user_id: userId,
      date: today,
      followers_count: followersCount,
      follower_delta: followerDelta,
      total_views: totalViews,
      total_likes: totalLikes,
      total_replies: totalReplies,
      post_count: todayPostCount,
    });

    return { success: true };
  } catch (error) {
    console.error(`Error syncing Threads insights for user ${userId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * GET: 全アクティブユーザーのThreadsインサイトを同期
 * POST: 特定ユーザーのThreadsインサイトを同期
 */
export async function GET() {
  try {
    // アクティブなThreadsユーザーを取得
    const users = await getActiveThreadsUsers();

    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active Threads users found',
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
      if (!user.threads_access_token || !user.threads_user_id) {
        results.push({
          userId: user.user_id,
          username: user.threads_username,
          success: false,
          error: 'Missing access token or Threads user ID',
        });
        continue;
      }

      const result = await syncUserInsights(
        user.user_id,
        user.threads_access_token,
        user.threads_user_id
      );

      results.push({
        userId: user.user_id,
        username: user.threads_username,
        ...result,
      });

      // API制限を考慮
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      message: `Synced Threads insights for ${successCount}/${users.length} users`,
      results,
    });
  } catch (error) {
    console.error('Threads insights sync error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, accessToken, threadsUserId } = body;

    if (!userId || !accessToken || !threadsUserId) {
      return NextResponse.json({
        success: false,
        error: 'userId, accessToken, and threadsUserId are required',
      }, { status: 400 });
    }

    const result = await syncUserInsights(userId, accessToken, threadsUserId);

    return NextResponse.json({
      success: result.success,
      error: result.error,
    });
  } catch (error) {
    console.error('Threads insights sync error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    }, { status: 500 });
  }
}
