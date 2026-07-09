import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveThreadsUsers,
  upsertThreadsDailyMetrics,
  getUserThreadsDailyMetrics,
  getUserThreadsPosts,
  getThreadsUserIdsWithMetricsOn,
} from '@/lib/bigquery';

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.all(batch.map(worker));
    results.push(...batchResults);
  }

  return results;
}
import { v4 as uuidv4 } from 'uuid';

// ディスパッチャーモードでサブリクエスト完了を待つため余裕を持たせる
export const maxDuration = 300;

const GRAPH_BASE = 'https://graph.threads.net/v1.0';

interface ThreadsUserInsights {
  followers_count?: number;
}

/**
 * Threadsユーザーのフォロワー数を取得
 */
async function getThreadsUserInsights(accessToken: string, threadsUserId: string): Promise<ThreadsUserInsights> {
  const response = await fetch(
    `${GRAPH_BASE}/${threadsUserId}/threads_insights?metric=followers_count&access_token=${accessToken}`
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get Threads user insights (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const insights: ThreadsUserInsights = {};

  if (data.data && Array.isArray(data.data)) {
    for (const metric of data.data) {
      if (metric.name === 'followers_count') {
        insights.followers_count = metric.total_value?.value;
      }
    }
  }

  if (insights.followers_count === undefined) {
    throw new Error('Threads followers_count metric missing from response');
  }

  return insights;
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
    // フォロワー数を取得。取得失敗時は0で上書きせず、このユーザーの同期を失敗扱いにする。
    const userInsights = await getThreadsUserInsights(accessToken, threadsUserId);
    const followersCount = userInsights.followers_count;

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

      // 全投稿の統計を集計（累計値）
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

    // 日別メトリクスを保存（累計値を保存、表示時に差分計算）
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
 * GET: Threadsインサイトを同期
 * - userId指定あり: そのユーザーのみ同期
 * - userId指定なし: ディスパッチャーモード（全ユーザーに個別HTTP fetch並列発行）
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    // ── 単一ユーザー同期モード ──
    if (targetUserId) {
      const users = await getActiveThreadsUsers();
      const user = users.find(u => u.user_id === targetUserId);

      if (!user) {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
      }

      if (!user.threads_access_token || !user.threads_user_id) {
        return NextResponse.json({ success: false, error: 'Missing access token or Threads user ID' }, { status: 400 });
      }

      const result = await syncUserInsights(
        user.user_id,
        user.threads_access_token,
        user.threads_user_id
      );

      return NextResponse.json({
        success: result.success,
        userId: user.user_id,
        username: user.threads_username,
        ...result,
      });
    }

    // ── ディスパッチャーモード（cron用） ──
    // 5分おきに起動し、「今日まだフォロワー記録がないユーザー」だけを少人数ずつ消化する。
    // 失敗したユーザーは記録が残らないため、次の起動が自動的に拾い直す（リトライは仕組み側で担保）。
    const users = await getActiveThreadsUsers();
    const validUsers = users.filter(u => u.threads_access_token && u.threads_user_id);

    if (validUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active Threads users found',
        results: [],
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const syncedUserIds = await getThreadsUserIdsWithMetricsOn(today);
    const pendingUsers = validUsers.filter(u => !syncedUserIds.has(u.user_id));

    if (pendingUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: `All ${validUsers.length} users already synced for ${today}`,
        results: [],
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://analyca.jp';
    const BATCH_SIZE = 30;
    const CONCURRENCY = 3;
    const batch = pendingUsers.slice(0, BATCH_SIZE);

    const dispatchUser = async (user: (typeof validUsers)[number]) => {
      try {
        const res = await fetch(
          `${appUrl}/api/sync/threads/insights?userId=${encodeURIComponent(user.user_id)}`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        return {
          userId: user.user_id,
          username: user.threads_username,
          success: data.success ?? false,
          error: data.error,
        };
      } catch (err) {
        return {
          userId: user.user_id,
          username: user.threads_username,
          success: false,
          error: err instanceof Error ? err.message : 'Dispatch failed',
        };
      }
    };

    const results = await runWithConcurrency(batch, CONCURRENCY, dispatchUser);
    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      message: `Synced ${successCount}/${batch.length} users (pending before run: ${pendingUsers.length}/${validUsers.length}) for ${today}`,
      failed: results.filter(r => !r.success).map(r => ({ username: r.username, error: r.error })),
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
