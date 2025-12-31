import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveInstagramUsers,
  upsertInstagramReels,
  InstagramReel,
} from '@/lib/bigquery';
import { uploadImageToGCS } from '@/lib/gcs';
import { v4 as uuidv4 } from 'uuid';

// Vercel Functionの最大実行時間を延長
export const maxDuration = 60;

const FACEBOOK_GRAPH_BASE = 'https://graph.facebook.com/v23.0';

interface InstagramMedia {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_product_type?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

interface ReelInsights {
  reach?: number;
  plays?: number;
  total_interactions?: number;
  likes?: number;
  comments?: number;
  saved?: number;
  shares?: number;
  video_view_total_time?: number;
}

/**
 * リール一覧を取得
 */
async function getReels(accessToken: string, accountId: string, limit = 15): Promise<InstagramMedia[]> {
  try {
    const response = await fetch(
      `${FACEBOOK_GRAPH_BASE}/${accountId}/media?fields=id,caption,media_type,media_product_type,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=${limit}&access_token=${accessToken}`
    );

    if (!response.ok) {
      console.warn('Failed to get media');
      return [];
    }

    const data = await response.json();
    // REELSのみフィルタ
    return (data.data || []).filter((media: InstagramMedia) =>
      media.media_type === 'VIDEO' && media.media_product_type === 'REELS'
    );
  } catch (error) {
    console.error('Error fetching reels:', error);
    return [];
  }
}

/**
 * リールのインサイトを取得
 */
async function getReelInsights(accessToken: string, reelId: string): Promise<ReelInsights> {
  const insights: ReelInsights = {};

  try {
    // リール専用のインサイトメトリクス
    const response = await fetch(
      `${FACEBOOK_GRAPH_BASE}/${reelId}/insights?metric=reach,plays,total_interactions,likes,comments,saved,shares,ig_reels_video_view_total_time&access_token=${accessToken}`
    );

    if (!response.ok) {
      return insights;
    }

    const data = await response.json();

    if (data.data && Array.isArray(data.data)) {
      for (const metric of data.data) {
        const value = metric.values?.[0]?.value;

        switch (metric.name) {
          case 'reach':
            insights.reach = value || 0;
            break;
          case 'plays':
            insights.plays = value || 0;
            break;
          case 'total_interactions':
            insights.total_interactions = value || 0;
            break;
          case 'likes':
            insights.likes = value || 0;
            break;
          case 'comments':
            insights.comments = value || 0;
            break;
          case 'saved':
            insights.saved = value || 0;
            break;
          case 'shares':
            insights.shares = value || 0;
            break;
          case 'ig_reels_video_view_total_time':
            insights.video_view_total_time = value || 0;
            break;
        }
      }
    }

    return insights;
  } catch (error) {
    console.error(`Error fetching reel insights for ${reelId}:`, error);
    return insights;
  }
}

/**
 * ユーザーのリールデータを同期
 */
async function syncUserReels(
  userId: string,
  accessToken: string,
  instagramUserId: string
): Promise<{ success: boolean; newCount: number; updatedCount: number; error?: string }> {
  try {
    // リール一覧を取得
    const reels = await getReels(accessToken, instagramUserId);

    if (reels.length === 0) {
      return { success: true, newCount: 0, updatedCount: 0 };
    }

    // 各リールのインサイトを取得
    const reelsWithInsights: InstagramReel[] = [];

    for (const reel of reels) {
      const insights = await getReelInsights(accessToken, reel.id);

      // 視聴時間を時間に変換（秒→時間）
      const viewTimeHours = insights.video_view_total_time
        ? (insights.video_view_total_time / 3600).toFixed(2)
        : '0';

      // 平均視聴時間を計算（総視聴時間 / 再生回数）
      const avgWatchTime = insights.plays && insights.video_view_total_time
        ? Math.round(insights.video_view_total_time / insights.plays)
        : 0;

      // サムネイルをGCSにアップロード
      const originalThumbnailUrl = reel.thumbnail_url || null;
      let thumbnailUrl = originalThumbnailUrl;
      if (originalThumbnailUrl) {
        const fileName = `reel_${reel.id}_${new Date(reel.timestamp).toISOString().replace(/[:.]/g, '-')}`;
        const gcsUrl = await uploadImageToGCS(originalThumbnailUrl, fileName, 'instagram/reels');
        if (gcsUrl) {
          thumbnailUrl = gcsUrl;
        }
      }

      reelsWithInsights.push({
        id: uuidv4(),
        user_id: userId,
        instagram_id: reel.id,
        caption: reel.caption || '',
        media_product_type: reel.media_product_type || 'REELS',
        media_type: reel.media_type,
        permalink: reel.permalink,
        timestamp: new Date(reel.timestamp),
        views: insights.plays || 0,
        reach: insights.reach || 0,
        total_interactions: insights.total_interactions || 0,
        like_count: insights.likes || reel.like_count || 0,
        comments_count: insights.comments || reel.comments_count || 0,
        saved: insights.saved || 0,
        shares: insights.shares || 0,
        video_view_total_time_hours: viewTimeHours,
        avg_watch_time_seconds: avgWatchTime,
        thumbnail_url: thumbnailUrl,
      });

      // API制限を考慮
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // BigQueryに保存（upsert）
    const result = await upsertInstagramReels(reelsWithInsights);

    return {
      success: true,
      newCount: result.newCount,
      updatedCount: result.updatedCount,
    };
  } catch (error) {
    console.error(`Error syncing reels for user ${userId}:`, error);
    return {
      success: false,
      newCount: 0,
      updatedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * GET: リールを同期
 * - userId指定あり: そのユーザーのみ同期
 * - userId指定なし: 全アクティブユーザーを同期（cron用）
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
      newCount: number;
      updatedCount: number;
      error?: string;
    }> = [];

    // 各ユーザーのリールを同期
    for (const user of users) {
      if (!user.access_token || !user.instagram_user_id) {
        results.push({
          userId: user.user_id,
          username: user.instagram_username,
          success: false,
          newCount: 0,
          updatedCount: 0,
          error: 'Missing access token or Instagram user ID',
        });
        continue;
      }

      const result = await syncUserReels(
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
    const totalNew = results.reduce((sum, r) => sum + r.newCount, 0);
    const totalUpdated = results.reduce((sum, r) => sum + r.updatedCount, 0);

    return NextResponse.json({
      success: true,
      message: `Synced reels for ${successCount}/${users.length} users`,
      totalNew,
      totalUpdated,
      results,
    });
  } catch (error) {
    console.error('Instagram reels sync error:', error);
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

    const result = await syncUserReels(userId, accessToken, instagramUserId);

    return NextResponse.json({
      success: result.success,
      newCount: result.newCount,
      updatedCount: result.updatedCount,
      error: result.error,
    });
  } catch (error) {
    console.error('Instagram reels sync error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    }, { status: 500 });
  }
}
