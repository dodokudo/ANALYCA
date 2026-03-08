import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveInstagramUsers,
  upsertInstagramReels,
  InstagramReel,
} from '@/lib/bigquery';
import { uploadImageToGCS } from '@/lib/gcs';
import { detectGraphBase } from '@/lib/instagram-graph';
import { v4 as uuidv4 } from 'uuid';

// Vercel Functionの最大実行時間を延長
export const maxDuration = 60;

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
  views?: number;
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
async function getReels(graphBase: string, accessToken: string, accountId: string, limit = 15): Promise<InstagramMedia[]> {
  try {
    const response = await fetch(
      `${graphBase}/${accountId}/media?fields=id,caption,media_type,media_product_type,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=${limit}&access_token=${accessToken}`
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
async function getReelInsights(graphBase: string, accessToken: string, reelId: string): Promise<ReelInsights> {
  const insights: ReelInsights = {};

  try {
    // リール専用のインサイトメトリクス
    const response = await fetch(
      `${graphBase}/${reelId}/insights?metric=reach,views,total_interactions,likes,comments,saved,shares,ig_reels_video_view_total_time&access_token=${accessToken}`
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
          case 'views':
            insights.views = value || 0;
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
    // トークンタイプに応じたGraph API Base URLを検出
    const graphBase = await detectGraphBase(accessToken, `/${instagramUserId}?fields=id`);

    // リール一覧を取得
    const reels = await getReels(graphBase, accessToken, instagramUserId);

    if (reels.length === 0) {
      return { success: true, newCount: 0, updatedCount: 0 };
    }

    // 各リールのインサイトを取得
    const reelsWithInsights: InstagramReel[] = [];

    for (const reel of reels) {
      const insights = await getReelInsights(graphBase, accessToken, reel.id);

      // 視聴時間を時間に変換（秒→時間）
      const viewTimeHours = insights.video_view_total_time
        ? (insights.video_view_total_time / 3600).toFixed(2)
        : '0';

      // 平均視聴時間を計算（総視聴時間 / 再生回数）
      const avgWatchTime = insights.views && insights.video_view_total_time
        ? Math.round(insights.video_view_total_time / insights.views)
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
        views: insights.views || 0,
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

      const result = await syncUserReels(
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
          `${appUrl}/api/sync/instagram/reels?userId=${encodeURIComponent(user.user_id)}`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        return {
          userId: user.user_id,
          username: user.instagram_username,
          success: data.success ?? false,
          newCount: data.newCount ?? 0,
          updatedCount: data.updatedCount ?? 0,
          error: data.error,
        };
      } catch (err) {
        return {
          userId: user.user_id,
          username: user.instagram_username,
          success: false,
          newCount: 0,
          updatedCount: 0,
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
