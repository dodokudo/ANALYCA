import { NextRequest, NextResponse } from 'next/server';
import { getUserById, getUserDashboardData } from '@/lib/bigquery';

/**
 * BigQueryのタイムスタンプを安全にシリアライズ
 * BigQueryは {value: "..."} 形式でタイムスタンプを返すことがある
 */
function serializeTimestamp(timestamp: unknown): string | null {
  if (!timestamp) return null;

  try {
    // BigQueryの {value: "..."} 形式
    if (typeof timestamp === 'object' && timestamp !== null && 'value' in timestamp) {
      const value = (timestamp as { value: unknown }).value;
      if (typeof value === 'string') return value;
      if (value instanceof Date) {
        const isoStr = value.toISOString();
        return isNaN(new Date(isoStr).getTime()) ? null : isoStr;
      }
      return String(value);
    }

    // Date型
    if (timestamp instanceof Date) {
      // 無効なDateチェック
      if (isNaN(timestamp.getTime())) return null;
      return timestamp.toISOString();
    }

    // 文字列
    if (typeof timestamp === 'string') {
      return timestamp;
    }

    // その他（数値など）
    return String(timestamp);
  } catch {
    // toISOString()などでエラーが発生した場合
    return null;
  }
}

/**
 * オブジェクト内のすべてのタイムスタンプフィールドをシリアライズ
 */
function serializeRecord<T extends Record<string, unknown>>(record: T): T {
  if (!record) return record;

  try {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (key === 'timestamp' || key === 'date' || key.endsWith('_at')) {
        result[key] = serializeTimestamp(value);
      } else if (typeof value === 'object' && value !== null && 'value' in value) {
        // 他のBigQuery形式のフィールドも変換
        result[key] = (value as { value: unknown }).value;
      } else {
        result[key] = value ?? null;
      }
    }
    return result as T;
  } catch {
    return record;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    // ユーザーの全データを取得
    const userRecordPromise = getUserById(userId);
    const dashboardDataPromise = getUserDashboardData(userId);
    const [userRecord, { reels, stories, insights, lineData, threadsPosts, threadsComments, threadsDailyMetrics, threadsDailyPostStats }] = await Promise.all([
      userRecordPromise,
      dashboardDataPromise,
    ]);

    // データを統合ダッシュボード形式に変換
    const dashboardData = {
      reels: {
        total: reels.length,
        totalViews: reels.reduce((sum, reel) => sum + (reel.views || 0), 0),
        totalLikes: reels.reduce((sum, reel) => sum + (reel.like_count || 0), 0),
        totalComments: reels.reduce((sum, reel) => sum + (reel.comments_count || 0), 0),
        totalReach: reels.reduce((sum, reel) => sum + (reel.reach || 0), 0),
        data: reels.map(reel => ({
          id: reel.instagram_id,
          caption: reel.caption,
          media_type: reel.media_type,
          permalink: reel.permalink,
          timestamp: serializeTimestamp(reel.timestamp),
          views: reel.views ?? 0,
          reach: reel.reach ?? 0,
          like_count: reel.like_count ?? 0,
          comments_count: reel.comments_count ?? 0,
          saved: reel.saved ?? 0,
          shares: reel.shares ?? 0,
          total_interactions: reel.total_interactions ?? 0,
          avg_watch_time_seconds: reel.avg_watch_time_seconds ?? 0,
          thumbnail_url: reel.thumbnail_url,
        }))
      },
      stories: {
        total: stories.length,
        totalViews: stories.reduce((sum, story) => sum + (story.views || 0), 0),
        totalReach: stories.reduce((sum, story) => sum + (story.reach || 0), 0),
        totalReplies: stories.reduce((sum, story) => sum + (story.replies || 0), 0),
        data: stories.map(story => ({
          id: story.instagram_id,
          timestamp: serializeTimestamp(story.timestamp),
          views: story.views ?? 0,
          reach: story.reach ?? 0,
          replies: story.replies ?? 0,
          total_interactions: story.total_interactions ?? 0,
          follows: story.follows ?? 0,
          profile_visits: story.profile_visits ?? 0,
          navigation: story.navigation ?? 0,
          thumbnail_url: story.thumbnail_url,
        }))
      },
      insights: {
        latest: insights[0] ? serializeRecord(insights[0] as unknown as Record<string, unknown>) : null,
        data: insights.map(i => serializeRecord(i as unknown as Record<string, unknown>))
      },
      lineData: {
        latest: lineData[0] ? serializeRecord(lineData[0] as unknown as Record<string, unknown>) : null,
        data: lineData.map(l => serializeRecord(l as unknown as Record<string, unknown>))
      },
      threads: {
        total: threadsPosts.length,
        totalViews: threadsPosts.reduce((sum, post) => sum + (post.views || 0), 0),
        totalLikes: threadsPosts.reduce((sum, post) => sum + (post.likes || 0), 0),
        totalReplies: threadsPosts.reduce((sum, post) => sum + (post.replies || 0), 0),
        totalReposts: threadsPosts.reduce((sum, post) => sum + (post.reposts || 0), 0),
        totalQuotes: threadsPosts.reduce((sum, post) => sum + (post.quotes || 0), 0),
        data: threadsPosts.map(post => ({
          id: post.id,
          threads_id: post.threads_id,
          text: post.text,
          timestamp: serializeTimestamp(post.timestamp),
          permalink: post.permalink,
          media_type: post.media_type,
          is_quote_post: post.is_quote_post,
          views: post.views ?? 0,
          likes: post.likes ?? 0,
          replies: post.replies ?? 0,
          reposts: post.reposts ?? 0,
          quotes: post.quotes ?? 0,
        }))
      },
      threadsComments: {
        total: threadsComments.length,
        totalViews: threadsComments.reduce((sum, c) => sum + (c.views || 0), 0),
        data: threadsComments.map(comment => ({
          id: comment.id,
          comment_id: comment.comment_id,
          parent_post_id: comment.parent_post_id,
          text: comment.text,
          timestamp: serializeTimestamp(comment.timestamp),
          permalink: comment.permalink,
          has_replies: comment.has_replies,
          views: comment.views ?? 0,
          depth: comment.depth ?? 0,
        }))
      },
      threadsDailyMetrics: {
        latest: threadsDailyMetrics[0] ? serializeRecord(threadsDailyMetrics[0] as unknown as Record<string, unknown>) : null,
        data: threadsDailyMetrics.map(m => ({
          date: serializeTimestamp(m.date),
          followers_count: m.followers_count ?? 0,
          follower_delta: m.follower_delta ?? 0,
          total_views: m.total_views ?? 0,
          total_likes: m.total_likes ?? 0,
          total_replies: m.total_replies ?? 0,
          post_count: m.post_count ?? 0,
        }))
      },
      threadsDailyPostStats: {
        latest: threadsDailyPostStats[0] ? serializeRecord(threadsDailyPostStats[0] as unknown as Record<string, unknown>) : null,
        data: threadsDailyPostStats.map(stat => ({
          date: serializeTimestamp(stat.date),
          post_count: stat.post_count ?? 0,
          total_views: stat.total_views ?? 0,
          total_likes: stat.total_likes ?? 0,
          total_replies: stat.total_replies ?? 0,
        }))
      },
      summary: {
        totalReelsViews: reels.reduce((sum, reel) => sum + (reel.views || 0), 0),
        totalStoriesViews: stories.reduce((sum, story) => sum + (story.views || 0), 0),
        currentFollowers: insights[0]?.followers_count || 0,
        lineFollowers: lineData[0]?.followers || 0,
        totalThreadsViews: threadsPosts.reduce((sum, post) => sum + (post.views || 0), 0),
        threadsFollowersCount: threadsDailyMetrics[0]?.followers_count || 0,
      }
    };

    return NextResponse.json({
      success: true,
      data: dashboardData,
      user: {
        threads_username: userRecord?.threads_username || null,
        threads_user_id: userRecord?.threads_user_id || null,
        threads_profile_picture_url: userRecord?.threads_profile_picture_url || null,
        instagram_username: userRecord?.instagram_username || null,
        instagram_user_id: userRecord?.instagram_user_id || null,
        instagram_profile_picture_url: userRecord?.instagram_profile_picture_url || null,
        subscription_status: userRecord?.subscription_status || null,
        subscription_expires_at: userRecord?.subscription_expires_at ? serializeTimestamp(userRecord.subscription_expires_at) : null,
        plan_id: userRecord?.plan_id || null,
      },
      channels: {
        instagram: !!userRecord?.has_instagram,
        threads: !!userRecord?.has_threads,
      },
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({
      success: false,
      error: 'ダッシュボードデータの取得に失敗しました',
      details: error instanceof Error ? error.message : '不明なエラー'
    }, { status: 500 });
  }
}
