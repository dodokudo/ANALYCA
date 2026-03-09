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
export const maxDuration = 300;

interface ReelListItem {
  id: string;
  media_type: string;
  media_product_type?: string;
  thumbnail_url?: string;
}

interface ReelWithInsights {
  id: string;
  caption?: string;
  media_product_type?: string;
  media_type: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
  thumbnail_url?: string;
  insights?: {
    data: Array<{
      name: string;
      values: Array<{ value: number }>;
    }>;
  };
}

/**
 * メディア一覧からリールIDを取得（ページネーション対応）
 */
async function getReelIds(graphBase: string, accessToken: string, accountId: string, limit = 50): Promise<ReelListItem[]> {
  const allReels: ReelListItem[] = [];
  let cursor: string | null = null;

  try {
    while (allReels.length < limit) {
      let url = `${graphBase}/${accountId}/media?fields=id,media_type,media_product_type,thumbnail_url&limit=${Math.min(limit, 50)}&access_token=${accessToken}`;
      if (cursor) {
        url += `&after=${cursor}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        console.warn('Failed to get media list:', response.status);
        break;
      }

      const data = await response.json();
      const media = data.data || [];
      if (media.length === 0) break;

      // REELSのみフィルタ
      const reels = media.filter((m: ReelListItem) =>
        m.media_type === 'VIDEO' || m.media_product_type === 'REELS'
      );
      allReels.push(...reels);

      cursor = data.paging?.cursors?.after || null;
      if (!cursor) break;
    }

    return allReels.slice(0, limit);
  } catch (error) {
    console.error('Error fetching reel IDs:', error);
    return allReels;
  }
}

/**
 * 個別リールの詳細データをinline insightsで取得（GASと同じ方式）
 */
async function getReelDetails(graphBase: string, accessToken: string, reelId: string): Promise<ReelWithInsights | null> {
  try {
    const metrics = 'views,reach,total_interactions,likes,comments,saved,shares,ig_reels_video_view_total_time,ig_reels_avg_watch_time';
    const fields = `id,caption,media_product_type,media_type,permalink,timestamp,like_count,comments_count,thumbnail_url,insights.metric(${metrics})`;
    const response = await fetch(
      `${graphBase}/${reelId}?fields=${encodeURIComponent(fields)}&access_token=${accessToken}`
    );

    if (!response.ok) {
      console.warn(`Failed to get reel details for ${reelId}:`, response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching reel details for ${reelId}:`, error);
    return null;
  }
}

/**
 * inline insightsからメトリクスを抽出するヘルパー
 */
function extractMetrics(insights?: ReelWithInsights['insights']): Record<string, number> {
  const metrics: Record<string, number> = {};
  if (!insights?.data) return metrics;
  for (const m of insights.data) {
    metrics[m.name] = m.values?.[0]?.value || 0;
  }
  return metrics;
}

/**
 * ユーザーのリールデータを同期
 */
async function syncUserReels(
  userId: string,
  accessToken: string,
  instagramUserId: string
): Promise<{ success: boolean; reelsCount: number; newCount: number; updatedCount: number; error?: string }> {
  try {
    // トークンタイプに応じたGraph API Base URLを検出
    const graphBase = await detectGraphBase(accessToken, `/${instagramUserId}?fields=id`);

    // メディア一覧からリールIDを取得（最新15件）
    const reelIds = await getReelIds(graphBase, accessToken, instagramUserId, 15);

    if (reelIds.length === 0) {
      return { success: true, reelsCount: 0, newCount: 0, updatedCount: 0 };
    }

    // 各リールの詳細データをinline insightsで取得（GASと同じ方式）
    const reelsWithInsights: InstagramReel[] = [];

    for (const reel of reelIds) {
      const data = await getReelDetails(graphBase, accessToken, reel.id);
      if (!data) continue;

      const metrics = extractMetrics(data.insights);

      // 視聴時間を時間に変換（ミリ秒→時間）
      const viewTimeMs = metrics.ig_reels_video_view_total_time || 0;
      const viewTimeHours = viewTimeMs > 0 ? (viewTimeMs / 1000 / 3600).toFixed(2) : '0';

      // 平均視聴時間（ミリ秒→秒）
      const avgWatchTimeMs = metrics.ig_reels_avg_watch_time || 0;
      const avgWatchTime = avgWatchTimeMs > 0 ? Math.round(avgWatchTimeMs / 1000) : 0;

      // サムネイルをGCSにアップロード
      const originalThumbnailUrl = data.thumbnail_url || reel.thumbnail_url || null;
      let thumbnailUrl = originalThumbnailUrl;
      if (originalThumbnailUrl) {
        const fileName = `reel_${reel.id}_${new Date(data.timestamp).toISOString().replace(/[:.]/g, '-')}`;
        const gcsUrl = await uploadImageToGCS(originalThumbnailUrl, fileName, 'instagram/reels');
        if (gcsUrl) {
          thumbnailUrl = gcsUrl;
        }
      }

      reelsWithInsights.push({
        id: uuidv4(),
        user_id: userId,
        instagram_id: data.id || reel.id,
        caption: data.caption || '',
        media_product_type: data.media_product_type || 'REELS',
        media_type: data.media_type || 'VIDEO',
        permalink: data.permalink,
        timestamp: new Date(data.timestamp),
        views: metrics.views || 0,
        reach: metrics.reach || 0,
        total_interactions: metrics.total_interactions || 0,
        like_count: metrics.likes || data.like_count || 0,
        comments_count: metrics.comments || data.comments_count || 0,
        saved: metrics.saved || 0,
        shares: metrics.shares || 0,
        video_view_total_time_hours: viewTimeHours,
        avg_watch_time_seconds: avgWatchTime,
        thumbnail_url: thumbnailUrl,
      });

      // API制限対策
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // BigQueryに保存（upsert）
    const result = await upsertInstagramReels(reelsWithInsights);

    return {
      success: true,
      reelsCount: reelsWithInsights.length,
      newCount: result.newCount,
      updatedCount: result.updatedCount,
    };
  } catch (error) {
    console.error(`Error syncing reels for user ${userId}:`, error);
    return {
      success: false,
      reelsCount: 0,
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
          reelsCount: data.reelsCount ?? 0,
          error: data.error,
        };
      } catch (err) {
        return {
          userId: user.user_id,
          username: user.instagram_username,
          success: false,
          reelsCount: 0,
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
      reelsCount: result.reelsCount,
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
