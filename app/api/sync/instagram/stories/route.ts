import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveInstagramUsers,
  upsertInstagramStories,
  InstagramStory,
} from '@/lib/bigquery';
import { uploadImageToGCS } from '@/lib/gcs';
import { detectGraphBase } from '@/lib/instagram-graph';
import { v4 as uuidv4 } from 'uuid';

// Vercel Functionの最大実行時間を延長
export const maxDuration = 300;

interface StoryWithInsights {
  id: string;
  media_type: string;
  timestamp: string;
  thumbnail_url?: string;
  media_url?: string;
  caption?: string;
  insights?: {
    data: Array<{
      name: string;
      values: Array<{ value: number | Record<string, number> }>;
    }>;
  };
}

/**
 * ストーリー一覧をインサイト込みで一括取得（GASと同じinline insights方式）
 * insights.metric()でfieldsに含めることで1リクエストでストーリー+insightsを同時取得
 */
async function getStoriesWithInsights(graphBase: string, accessToken: string, accountId: string): Promise<StoryWithInsights[]> {
  try {
    const fields = 'id,media_type,timestamp,thumbnail_url,media_url,caption,insights.metric(views,reach,replies,total_interactions,follows,profile_visits,navigation)';
    const response = await fetch(
      `${graphBase}/${accountId}/stories?fields=${encodeURIComponent(fields)}&limit=50&access_token=${accessToken}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.warn('Failed to get stories:', response.status, errorText);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching stories:', error);
    return [];
  }
}

/**
 * inline insightsからメトリクスを抽出するヘルパー
 */
function extractMetrics(insights?: StoryWithInsights['insights']): Record<string, number> {
  const metrics: Record<string, number> = {};
  if (!insights?.data) return metrics;
  for (const m of insights.data) {
    const val = m.values?.[0]?.value;
    if (typeof val === 'number') {
      metrics[m.name] = val;
    } else if (typeof val === 'object' && val !== null) {
      // navigationはオブジェクト {forward, back, exited}
      metrics[m.name] = Object.values(val).reduce((sum, v) => sum + (v || 0), 0);
    }
  }
  return metrics;
}

/**
 * ユーザーのストーリーデータを同期
 */
async function syncUserStories(
  userId: string,
  accessToken: string,
  instagramUserId: string
): Promise<{ success: boolean; storiesCount: number; newCount: number; updatedCount: number; error?: string }> {
  try {
    // トークンタイプに応じたGraph API Base URLを検出
    const graphBase = await detectGraphBase(accessToken, `/${instagramUserId}?fields=id`);

    // ストーリー一覧をinsights込みで一括取得
    const stories = await getStoriesWithInsights(graphBase, accessToken, instagramUserId);

    if (stories.length === 0) {
      return { success: true, storiesCount: 0, newCount: 0, updatedCount: 0 };
    }

    const storiesData: InstagramStory[] = [];

    for (const story of stories) {
      const metrics = extractMetrics(story.insights);

      // サムネイル取得（thumbnail_urlがなければmedia_urlを使用）
      const originalThumbnailUrl = story.thumbnail_url || story.media_url || null;
      let thumbnailUrl = originalThumbnailUrl;
      if (originalThumbnailUrl) {
        const fileName = `story_${story.id}_${new Date(story.timestamp).toISOString().replace(/[:.]/g, '-')}`;
        const gcsUrl = await uploadImageToGCS(originalThumbnailUrl, fileName, 'instagram/stories');
        if (gcsUrl) {
          thumbnailUrl = gcsUrl;
        }
      }

      storiesData.push({
        id: uuidv4(),
        user_id: userId,
        instagram_id: story.id,
        thumbnail_url: thumbnailUrl,
        timestamp: new Date(story.timestamp),
        caption: story.caption,
        views: metrics.views || 0,
        reach: metrics.reach || 0,
        replies: metrics.replies || 0,
        total_interactions: metrics.total_interactions || 0,
        follows: metrics.follows || 0,
        profile_visits: metrics.profile_visits || 0,
        navigation: metrics.navigation || 0,
      });

      // API制限対策
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // BigQueryに保存（upsert）
    const result = await upsertInstagramStories(storiesData);

    return {
      success: true,
      storiesCount: storiesData.length,
      newCount: result.newCount,
      updatedCount: result.updatedCount,
    };
  } catch (error) {
    console.error(`Error syncing stories for user ${userId}:`, error);
    return {
      success: false,
      storiesCount: 0,
      newCount: 0,
      updatedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * GET: ストーリーを同期
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

      const result = await syncUserStories(
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
          `${appUrl}/api/sync/instagram/stories?userId=${encodeURIComponent(user.user_id)}`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        return {
          userId: user.user_id,
          username: user.instagram_username,
          success: data.success ?? false,
          storiesCount: data.storiesCount ?? 0,
          error: data.error,
        };
      } catch (err) {
        return {
          userId: user.user_id,
          username: user.instagram_username,
          success: false,
          storiesCount: 0,
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
    console.error('Instagram stories sync error:', error);
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

    const result = await syncUserStories(userId, accessToken, instagramUserId);

    return NextResponse.json({
      success: result.success,
      storiesCount: result.storiesCount,
      error: result.error,
    });
  } catch (error) {
    console.error('Instagram stories sync error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    }, { status: 500 });
  }
}
