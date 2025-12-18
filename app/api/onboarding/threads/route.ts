import { NextRequest, NextResponse } from 'next/server';
import { upsertThreadsUser, getUserById, insertThreadsPosts, upsertThreadsDailyMetrics } from '@/lib/bigquery';
import { v4 as uuidv4 } from 'uuid';

// Vercel Functionの最大実行時間を延長（Hobbyプラン: 最大60秒、Proプラン: 最大300秒）
export const maxDuration = 60;

const GRAPH_BASE = 'https://graph.threads.net/v1.0';

interface ThreadsAccountInfo {
  id: string;
  username: string;
  threads_profile_picture_url?: string;
  threads_biography?: string;
}

interface ThreadsUserInsights {
  followers_count?: number;
}

interface ThreadsPost {
  id: string;
  text: string;
  timestamp: string;
  permalink: string;
  media_type: string;
  is_quote_post?: boolean;
}

interface ThreadsReply {
  id: string;
  text: string;
  username: string;
  timestamp: string;
  permalink: string;
  has_replies: boolean;
  reply_to_root_post_id?: string;
}

interface ThreadsInsights {
  views?: number;
  likes?: number;
  replies?: number;
  reposts?: number;
  quotes?: number;
}

/**
 * アクセストークンからThreadsユーザー情報を取得
 */
async function getThreadsAccountInfo(accessToken: string): Promise<ThreadsAccountInfo> {
  const response = await fetch(
    `${GRAPH_BASE}/me?fields=id,username,threads_profile_picture_url,threads_biography&access_token=${accessToken}`
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Threadsアカウント情報の取得に失敗しました: ${error}`);
  }

  return await response.json();
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
 * Threads投稿一覧を取得
 */
async function getThreadsPosts(accessToken: string, limit = 100): Promise<ThreadsPost[]> {
  const response = await fetch(
    `${GRAPH_BASE}/me/threads?fields=id,text,timestamp,permalink,media_type,is_quote_post&limit=${limit}&access_token=${accessToken}`
  );

  if (!response.ok) {
    console.warn('Failed to get Threads posts');
    return [];
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * 投稿のインサイトを取得
 */
async function getPostInsights(accessToken: string, postId: string): Promise<ThreadsInsights> {
  try {
    const response = await fetch(
      `${GRAPH_BASE}/${postId}/insights?metric=views,likes,replies,reposts,quotes&access_token=${accessToken}`
    );

    if (!response.ok) {
      return {};
    }

    const data = await response.json();
    const insights: ThreadsInsights = {};

    if (data.data && Array.isArray(data.data)) {
      for (const metric of data.data) {
        switch (metric.name) {
          case 'views':
            insights.views = metric.values?.[0]?.value || 0;
            break;
          case 'likes':
            insights.likes = metric.values?.[0]?.value || 0;
            break;
          case 'replies':
            insights.replies = metric.values?.[0]?.value || 0;
            break;
          case 'reposts':
            insights.reposts = metric.values?.[0]?.value || 0;
            break;
          case 'quotes':
            insights.quotes = metric.values?.[0]?.value || 0;
            break;
        }
      }
    }

    return insights;
  } catch {
    return {};
  }
}

/**
 * 投稿に対する返信を取得（1レベル）
 */
async function getReplies(accessToken: string, postId: string): Promise<ThreadsReply[]> {
  try {
    const response = await fetch(
      `${GRAPH_BASE}/${postId}/replies?fields=id,text,username,timestamp,permalink,has_replies,reply_to_root_post_id&access_token=${accessToken}`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch {
    return [];
  }
}

/**
 * 投稿に紐づく自分のコメントツリーを再帰的に取得（GASスクリプトのC_getMyCommentTree相当）
 * コメント欄1、コメント欄2...のように続きを全て取得
 */
async function getMyCommentTree(
  accessToken: string,
  rootPostId: string,
  myUsername: string
): Promise<Array<ThreadsReply & { depth: number }>> {
  const myComments: Array<ThreadsReply & { depth: number }> = [];
  const queue: Array<{ id: string; depth: number }> = [{ id: rootPostId, depth: 0 }];
  const processedIds = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (processedIds.has(current.id)) continue;
    processedIds.add(current.id);

    try {
      const replies = await getReplies(accessToken, current.id);

      for (const reply of replies) {
        // 自分のリプライのみを収集
        if (reply.username === myUsername) {
          myComments.push({
            ...reply,
            reply_to_root_post_id: rootPostId, // 元の投稿IDを保持
            depth: current.depth,
          });

          // has_repliesがtrueならさらに深く探索
          if (reply.has_replies) {
            queue.push({ id: reply.id, depth: current.depth + 1 });
          }
        }
      }

      // API制限を考慮
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (e) {
      console.warn(`コメント取得エラー (ID: ${current.id}):`, e);
    }
  }

  return myComments;
}

/**
 * コメントの閲覧数を取得
 */
async function getCommentViews(accessToken: string, commentId: string): Promise<number> {
  try {
    const response = await fetch(
      `${GRAPH_BASE}/${commentId}/insights?metric=views&access_token=${accessToken}`
    );

    if (!response.ok) {
      return 0;
    }

    const data = await response.json();
    if (data.data && data.data[0]) {
      return data.data[0].values?.[0]?.value || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken } = body;

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'アクセストークンが提供されていません'
      }, { status: 400 });
    }

    // 1. アクセストークンからユーザー情報を取得
    const accountInfo = await getThreadsAccountInfo(accessToken);

    // 2. ユーザー情報を保存（user_id = threads_user_id = instagram_user_id で統一）
    // トークンの有効期限は入力されたものなので長期とみなす
    const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60日後

    // user_idをThreadsアカウントIDと同じにする（新規も既存も同じIDになる）
    const userId = await upsertThreadsUser({
      user_id: accountInfo.id, // user_id = threads_user_id
      threads_user_id: accountInfo.id,
      threads_username: accountInfo.username,
      threads_access_token: accessToken,
      threads_token_expires_at: tokenExpiresAt,
      threads_profile_picture_url: accountInfo.threads_profile_picture_url,
    });

    // 3. フォロワー数を取得
    const userInsights = await getThreadsUserInsights(accessToken, accountInfo.id);
    const followersCount = userInsights.followers_count || 0;

    // 4. Threads投稿データを取得（オンボーディング時は5件に制限してタイムアウト防止）
    const posts = await getThreadsPosts(accessToken, 5);

    // 5. 各投稿のインサイトを順次取得（並列だとAPI制限に引っかかる可能性）
    const postsWithInsights: Array<{
      id: string;
      user_id: string;
      threads_id: string;
      text: string;
      timestamp: Date;
      permalink: string;
      media_type: string;
      is_quote_post: boolean;
      views: number;
      likes: number;
      replies: number;
      reposts: number;
      quotes: number;
    }> = [];

    for (const post of posts) {
      const insights = await getPostInsights(accessToken, post.id);
      postsWithInsights.push({
        id: uuidv4(),
        user_id: userId,
        threads_id: post.id,
        text: post.text || '',
        timestamp: new Date(post.timestamp),
        permalink: post.permalink,
        media_type: post.media_type,
        is_quote_post: post.is_quote_post || false,
        views: insights.views || 0,
        likes: insights.likes || 0,
        replies: insights.replies || 0,
        reposts: insights.reposts || 0,
        quotes: insights.quotes || 0,
      });
      // API制限対策（短いディレイ）
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 6. コメント取得はオンボーディング時はスキップ（タイムアウト防止）
    // コメントは後の同期処理(/api/sync/threads/posts)で取得される

    // 7. BigQueryに保存
    if (postsWithInsights.length > 0) {
      await insertThreadsPosts(postsWithInsights);
    }

    // 8. 日別メトリクスを保存
    const today = new Date().toISOString().split('T')[0];
    const totalViews = postsWithInsights.reduce((sum, post) => sum + post.views, 0);
    const totalLikes = postsWithInsights.reduce((sum, post) => sum + post.likes, 0);
    const totalRepliesCount = postsWithInsights.reduce((sum, post) => sum + post.replies, 0);

    // その日に投稿された数を計算（timestampが今日の投稿）
    const todayPostCount = postsWithInsights.filter(post => {
      const postDate = post.timestamp.toISOString().split('T')[0];
      return postDate === today;
    }).length;

    // 前日のフォロワー数を取得してフォロワー増減を計算
    let followerDelta = 0;
    try {
      const { getUserThreadsDailyMetrics } = await import('@/lib/bigquery');
      const previousMetrics = await getUserThreadsDailyMetrics(userId, 2);
      if (previousMetrics.length > 0) {
        // 前日のデータがあれば差分を計算
        const yesterday = previousMetrics.find(m => m.date !== today);
        if (yesterday) {
          followerDelta = followersCount - yesterday.followers_count;
        }
      }
    } catch {
      // エラー時は0
    }

    try {
      await upsertThreadsDailyMetrics({
        id: uuidv4(),
        user_id: userId,
        date: today,
        followers_count: followersCount,
        follower_delta: followerDelta,
        total_views: totalViews,
        total_likes: totalLikes,
        total_replies: totalRepliesCount,
        post_count: todayPostCount, // その日の投稿数
      });
    } catch (e) {
      console.warn('日別メトリクス保存に失敗:', e);
    }

    // 9. ユーザー情報を取得
    const userRecord = await getUserById(userId);

    return NextResponse.json({
      success: true,
      userId,
      accountInfo: {
        username: accountInfo.username,
        threadsUserId: accountInfo.id,
        followersCount: followersCount,
        totalPosts: postsWithInsights.length,
        totalViews: totalViews,
        totalLikes: totalLikes,
      },
      channels: {
        instagram: !!userRecord?.has_instagram,
        threads: !!userRecord?.has_threads,
      },
      message: `Threadsセットアップが完了しました！\n\nユーザー: ${accountInfo.username}\nフォロワー: ${followersCount.toLocaleString()}人\n投稿数: ${postsWithInsights.length}件`
    });

  } catch (error) {
    console.error('Threads onboarding error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'セットアップに失敗しました'
    }, { status: 500 });
  }
}
