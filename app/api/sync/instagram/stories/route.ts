import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveInstagramUsers,
  upsertInstagramStories,
  InstagramStory,
} from '@/lib/bigquery';
import { uploadImageToGCS } from '@/lib/gcs';
import { v4 as uuidv4 } from 'uuid';

// Vercel Functionの最大実行時間を延長
export const maxDuration = 60;

const FACEBOOK_GRAPH_BASE = 'https://graph.facebook.com/v23.0';

interface StoryInsights {
  reach?: number;
  impressions?: number;
  replies?: number;
  follows?: number;
  profile_visits?: number;
  shares?: number;
  navigation_forward?: number;
  navigation_back?: number;
  navigation_exit?: number;
}

/**
 * Instagramビジネスアカウント情報を取得
 */
async function getInstagramBusinessAccountId(accessToken: string): Promise<string | null> {
  try {
    const pagesResponse = await fetch(
      `${FACEBOOK_GRAPH_BASE}/me/accounts?access_token=${accessToken}`
    );

    if (!pagesResponse.ok) return null;

    const pagesData = await pagesResponse.json();

    if (!pagesData.data || pagesData.data.length === 0) return null;

    for (const page of pagesData.data) {
      const igResponse = await fetch(
        `${FACEBOOK_GRAPH_BASE}/${page.id}?fields=instagram_business_account&access_token=${accessToken}`
      );

      if (!igResponse.ok) continue;

      const igData = await igResponse.json();

      if (igData.instagram_business_account) {
        return igData.instagram_business_account.id;
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to get Instagram business account:', error);
    return null;
  }
}

/**
 * ストーリー一覧を取得
 */
async function getStories(accessToken: string, accountId: string): Promise<Array<{
  id: string;
  media_type: string;
  timestamp: string;
  thumbnail_url?: string;
  media_url?: string;
  caption?: string;
}>> {
  try {
    const response = await fetch(
      `${FACEBOOK_GRAPH_BASE}/${accountId}/stories?fields=id,media_type,timestamp,thumbnail_url,media_url,caption&access_token=${accessToken}`
    );

    if (!response.ok) {
      console.warn('Failed to get stories');
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
 * ストーリーのインサイトを取得
 */
async function getStoryInsights(accessToken: string, storyId: string): Promise<StoryInsights> {
  const insights: StoryInsights = {};

  try {
    const response = await fetch(
      `${FACEBOOK_GRAPH_BASE}/${storyId}/insights?metric=reach,impressions,replies,follows,profile_visits,shares,navigation&access_token=${accessToken}`
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
          case 'impressions':
            insights.impressions = value || 0;
            break;
          case 'replies':
            insights.replies = value || 0;
            break;
          case 'follows':
            insights.follows = value || 0;
            break;
          case 'profile_visits':
            insights.profile_visits = value || 0;
            break;
          case 'shares':
            insights.shares = value || 0;
            break;
          case 'navigation':
            // navigationはオブジェクトで返ってくる
            if (typeof value === 'object' && value !== null) {
              insights.navigation_forward = value.forward || 0;
              insights.navigation_back = value.back || 0;
              insights.navigation_exit = value.exited || 0;
            }
            break;
        }
      }
    }

    return insights;
  } catch (error) {
    console.error(`Error fetching story insights for ${storyId}:`, error);
    return insights;
  }
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
    // Instagram Business Account IDを取得（instagramUserIdと同じはず）
    const accountId = instagramUserId || await getInstagramBusinessAccountId(accessToken);

    if (!accountId) {
      return { success: false, storiesCount: 0, newCount: 0, updatedCount: 0, error: 'Instagram account not found' };
    }

    // ストーリー一覧を取得
    const stories = await getStories(accessToken, accountId);

    if (stories.length === 0) {
      return { success: true, storiesCount: 0, newCount: 0, updatedCount: 0 };
    }

    // 各ストーリーのインサイトを取得し、サムネイルをDriveにアップロード
    const storiesWithInsights: InstagramStory[] = [];

    for (const story of stories) {
      const insights = await getStoryInsights(accessToken, story.id);

      // 遷移数を合計（forward + back + exit）
      const navigation = (insights.navigation_forward || 0) +
                        (insights.navigation_back || 0) +
                        (insights.navigation_exit || 0);

      // total_interactionsを計算（replies + follows + profile_visits + shares）
      const totalInteractions = (insights.replies || 0) +
                                (insights.follows || 0) +
                                (insights.profile_visits || 0) +
                                (insights.shares || 0);

      // サムネイル取得（thumbnail_urlがなければmedia_urlを使用）
      const originalThumbnailUrl = story.thumbnail_url || story.media_url || null;
      let thumbnailUrl = originalThumbnailUrl;
      if (originalThumbnailUrl) {
        // GCSにアップロード試行（失敗時は元URLを使用）
        const fileName = `story_${story.id}_${new Date(story.timestamp).toISOString().replace(/[:.]/g, '-')}`;
        const gcsUrl = await uploadImageToGCS(originalThumbnailUrl, fileName, 'instagram/stories');
        if (gcsUrl) {
          thumbnailUrl = gcsUrl;
        }
      }

      storiesWithInsights.push({
        id: uuidv4(),
        user_id: userId,
        instagram_id: story.id,
        thumbnail_url: thumbnailUrl,
        timestamp: new Date(story.timestamp),
        caption: story.caption,
        views: insights.impressions || 0,
        reach: insights.reach || 0,
        replies: insights.replies || 0,
        total_interactions: totalInteractions,
        follows: insights.follows || 0,
        profile_visits: insights.profile_visits || 0,
        navigation: navigation,
      });

      // API制限対策
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // BigQueryに保存（upsert）
    const result = await upsertInstagramStories(storiesWithInsights);

    return {
      success: true,
      storiesCount: storiesWithInsights.length,
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
      storiesCount: number;
      error?: string;
    }> = [];

    // 各ユーザーのストーリーを同期
    for (const user of users) {
      if (!user.access_token || !user.instagram_user_id) {
        results.push({
          userId: user.user_id,
          username: user.instagram_username,
          success: false,
          storiesCount: 0,
          error: 'Missing access token or Instagram user ID',
        });
        continue;
      }

      const result = await syncUserStories(
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
    const totalStories = results.reduce((sum, r) => sum + r.storiesCount, 0);

    return NextResponse.json({
      success: true,
      message: `Synced stories for ${successCount}/${users.length} users`,
      totalStories,
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
