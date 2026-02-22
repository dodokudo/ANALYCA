import { NextRequest, NextResponse } from 'next/server';
import {
  upsertUser,
  findUserIdByInstagramId,
  getUserById,
  insertInstagramReels,
  insertInstagramStories,
  insertInstagramInsights,
  InstagramReel,
  InstagramStory,
  InstagramInsights
} from '@/lib/bigquery';
import { v4 as uuidv4 } from 'uuid';

// Vercel Functionの最大実行時間を延長
export const maxDuration = 60;

const FACEBOOK_GRAPH_BASE = 'https://graph.facebook.com/v23.0';

// ============ Instagram関連 ============

interface InstagramUser {
  id: string;
  username: string;
  media_count: number;
  followers_count: number;
  follows_count: number;
  profile_picture_url?: string;
}

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
}

/**
 * リールのインサイトを取得
 */
async function getReelInsights(accessToken: string, reelId: string): Promise<ReelInsights> {
  try {
    const response = await fetch(
      `${FACEBOOK_GRAPH_BASE}/${reelId}/insights?metric=reach,views,total_interactions,likes,comments,saved,shares&access_token=${accessToken}`
    );

    if (!response.ok) return {};

    const data = await response.json();
    const insights: ReelInsights = {};

    if (data.data && Array.isArray(data.data)) {
      for (const metric of data.data) {
        const value = metric.values?.[0]?.value;
        switch (metric.name) {
          case 'reach': insights.reach = value || 0; break;
          case 'views': insights.views = value || 0; break;
          case 'total_interactions': insights.total_interactions = value || 0; break;
          case 'likes': insights.likes = value || 0; break;
          case 'comments': insights.comments = value || 0; break;
          case 'saved': insights.saved = value || 0; break;
          case 'shares': insights.shares = value || 0; break;
        }
      }
    }
    return insights;
  } catch {
    return {};
  }
}

/**
 * 短期トークンを長期トークンに変換
 */
async function exchangeForLongTermToken(shortToken: string, appId: string, appSecret: string): Promise<string> {
  const response = await fetch(
    `${FACEBOOK_GRAPH_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`トークン交換に失敗しました: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Instagramビジネスアカウント情報を取得
 */
async function getInstagramAccount(accessToken: string): Promise<InstagramUser> {
  // 1. Facebookページを取得
  const pagesResponse = await fetch(
    `${FACEBOOK_GRAPH_BASE}/me/accounts?access_token=${accessToken}`
  );

  if (!pagesResponse.ok) {
    const error = await pagesResponse.text();
    throw new Error(`Facebookページの取得に失敗しました: ${error}`);
  }

  const pagesData = await pagesResponse.json();

  if (!pagesData.data || pagesData.data.length === 0) {
    throw new Error('Facebookページが見つかりません。Facebookページを作成し、Instagramビジネスアカウントにリンクしてください。');
  }

  // 2. Instagram接続されているページを探す
  for (const page of pagesData.data) {
    const igResponse = await fetch(
      `${FACEBOOK_GRAPH_BASE}/${page.id}?fields=instagram_business_account&access_token=${accessToken}`
    );

    if (!igResponse.ok) continue;

    const igData = await igResponse.json();

    if (igData.instagram_business_account) {
      // 3. Instagramアカウント詳細を取得（profile_picture_url含む）
      const accountResponse = await fetch(
        `${FACEBOOK_GRAPH_BASE}/${igData.instagram_business_account.id}?fields=id,username,media_count,followers_count,follows_count,profile_picture_url&access_token=${accessToken}`
      );

      if (!accountResponse.ok) {
        const error = await accountResponse.text();
        throw new Error(`Instagramアカウント情報の取得に失敗しました: ${error}`);
      }

      return await accountResponse.json();
    }
  }

  throw new Error('Instagramビジネスアカウントが見つかりません。Instagramアカウントをビジネスまたはクリエイターアカウントに変換し、Facebookページにリンクしてください。');
}

/**
 * Instagramリールデータを取得（インサイト含む）
 */
async function getInstagramReels(accessToken: string, accountId: string, userId: string): Promise<InstagramReel[]> {
  const response = await fetch(
    `${FACEBOOK_GRAPH_BASE}/${accountId}/media?fields=id,caption,media_type,media_product_type,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=5&access_token=${accessToken}`
  );

  if (!response.ok) return [];

  const data = await response.json();
  const reels = (data.data || []).filter((media: InstagramMedia) =>
    media.media_type === 'VIDEO' && media.media_product_type === 'REELS'
  );

  const reelsWithInsights: InstagramReel[] = [];

  for (const reel of reels) {
    // 各リールのインサイトを取得
    const insights = await getReelInsights(accessToken, reel.id);

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
      video_view_total_time_hours: '0',
      avg_watch_time_seconds: 0,
      thumbnail_url: reel.thumbnail_url,
    });

    // API制限対策
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return reelsWithInsights;
}

/**
 * ストーリーのインサイトを取得
 */
async function getStoryInsights(accessToken: string, storyId: string): Promise<{
  reach: number;
  impressions: number;
  replies: number;
  follows: number;
  profile_visits: number;
  shares: number;
  navigation: number;
}> {
  try {
    const response = await fetch(
      `${FACEBOOK_GRAPH_BASE}/${storyId}/insights?metric=reach,impressions,replies,follows,profile_visits,shares,navigation&access_token=${accessToken}`
    );

    if (!response.ok) {
      return { reach: 0, impressions: 0, replies: 0, follows: 0, profile_visits: 0, shares: 0, navigation: 0 };
    }

    const data = await response.json();
    const result = { reach: 0, impressions: 0, replies: 0, follows: 0, profile_visits: 0, shares: 0, navigation: 0 };

    if (data.data && Array.isArray(data.data)) {
      for (const metric of data.data) {
        const value = metric.values?.[0]?.value;
        switch (metric.name) {
          case 'reach': result.reach = value || 0; break;
          case 'impressions': result.impressions = value || 0; break;
          case 'replies': result.replies = value || 0; break;
          case 'follows': result.follows = value || 0; break;
          case 'profile_visits': result.profile_visits = value || 0; break;
          case 'shares': result.shares = value || 0; break;
          case 'navigation':
            if (typeof value === 'object' && value !== null) {
              result.navigation = (value.forward || 0) + (value.back || 0) + (value.exited || 0);
            }
            break;
        }
      }
    }
    return result;
  } catch {
    return { reach: 0, impressions: 0, replies: 0, follows: 0, profile_visits: 0, shares: 0, navigation: 0 };
  }
}

/**
 * Instagramストーリーデータを取得（オンボーディング時は5件まで、Driveアップロードはスキップ）
 */
async function getInstagramStories(accessToken: string, accountId: string, userId: string): Promise<InstagramStory[]> {
  const response = await fetch(
    `${FACEBOOK_GRAPH_BASE}/${accountId}/stories?fields=id,media_type,media_url,thumbnail_url,timestamp&access_token=${accessToken}`
  );

  if (!response.ok) return [];

  const data = await response.json();
  const stories: InstagramStory[] = [];

  // オンボーディング時は5件に制限（タイムアウト防止）
  const storiesToProcess = (data.data || []).slice(0, 5);

  for (const story of storiesToProcess) {
    // 各ストーリーのインサイトを取得
    const insights = await getStoryInsights(accessToken, story.id);

    // Driveアップロードはオンボーディング時はスキップ（同期時に行う）
    const thumbnailUrl = story.thumbnail_url || story.media_url || null;

    stories.push({
      id: uuidv4(),
      user_id: userId,
      instagram_id: story.id,
      thumbnail_url: thumbnailUrl,
      timestamp: new Date(story.timestamp),
      views: insights.impressions,
      reach: insights.reach,
      replies: insights.replies,
      total_interactions: insights.replies + insights.follows + insights.profile_visits + insights.shares,
      follows: insights.follows,
      profile_visits: insights.profile_visits,
      navigation: insights.navigation,
    });

    // API制限対策（短縮）
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return stories;
}

/**
 * Instagramインサイトデータを取得
 */
function createInstagramInsights(userId: string, account: InstagramUser): InstagramInsights {
  const today = new Date();
  return {
    id: uuidv4(),
    user_id: userId,
    date: today.toISOString().split('T')[0],
    followers_count: account.followers_count,
    posts_count: account.media_count,
    reach: 0,
    engagement: 0,
    profile_views: 0,
    website_clicks: 0,
  };
}

// ============ メインAPI ============

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { instagram, userId: requestUserId } = body;

    if (!instagram?.appId || !instagram?.appSecret || !instagram?.shortToken) {
      return NextResponse.json({
        success: false,
        error: 'Instagramの認証情報が不足しています'
      }, { status: 400 });
    }

    // ============ Instagram処理 ============
    // 短期トークン → 長期トークン
    const instagramLongToken = await exchangeForLongTermToken(
      instagram.shortToken,
      instagram.appId,
      instagram.appSecret
    );

    const instagramAccount = await getInstagramAccount(instagramLongToken);
    const existingInstagramUserId = await findUserIdByInstagramId(instagramAccount.id);

    // ============ ユーザーID決定 ============
    // requestUserId（決済後の仮ユーザー）を最優先、次に既存ユーザー、なければ新規作成
    const userId = requestUserId || existingInstagramUserId || uuidv4();

    // ============ Instagramユーザー保存 ============
    const instagramTokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    await upsertUser({
      user_id: userId,
      instagram_user_id: instagramAccount.id,
      instagram_username: instagramAccount.username,
      instagram_profile_picture_url: instagramAccount.profile_picture_url,
      access_token: instagramLongToken,
      token_expires_at: instagramTokenExpiresAt,
    });

    // ============ Instagramデータ取得・保存 ============
    const [reels, stories] = await Promise.all([
      getInstagramReels(instagramLongToken, instagramAccount.id, userId),
      getInstagramStories(instagramLongToken, instagramAccount.id, userId),
    ]);

    const insights = createInstagramInsights(userId, instagramAccount);

    await Promise.all([
      reels.length > 0 ? insertInstagramReels(reels) : Promise.resolve(),
      stories.length > 0 ? insertInstagramStories(stories) : Promise.resolve(),
      insertInstagramInsights([insights]),
    ]);

    // ============ レスポンス ============
    const userRecord = await getUserById(userId);

    return NextResponse.json({
      success: true,
      userId,
      syncPending: true, // クライアント側でバックグラウンド同期を呼び出す
      accountInfo: {
        instagram: {
          username: instagramAccount.username,
          instagramUserId: instagramAccount.id,
          followers: instagramAccount.followers_count,
          totalReels: reels.length,
          totalStories: stories.length,
        },
      },
      channels: {
        instagram: !!userRecord?.has_instagram,
        threads: !!userRecord?.has_threads,
      },
      message: `セットアップが完了しました！\n\nInstagram: ${instagramAccount.username}`
    });

  } catch (error) {
    console.error('Lite2 onboarding error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'セットアップに失敗しました'
    }, { status: 500 });
  }
}
