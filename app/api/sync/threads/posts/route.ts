import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveThreadsUsers,
  insertThreadsPosts,
  insertThreadsComments,
  ThreadsPost,
  ThreadsComment,
} from '@/lib/bigquery';
import { v4 as uuidv4 } from 'uuid';

// 1ユーザーの同期は並列化で10-15秒。cron(dispatcher)モードでも60秒で十分
export const maxDuration = 60;

const GRAPH_BASE = 'https://graph.threads.net/v1.0';

interface ThreadsPostData {
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
 * Threads投稿一覧を取得
 */
async function getThreadsPosts(accessToken: string, limit = 100): Promise<ThreadsPostData[]> {
  try {
    const response = await fetch(
      `${GRAPH_BASE}/me/threads?fields=id,text,timestamp,permalink,media_type,is_quote_post&limit=${limit}&access_token=${accessToken}`
    );

    if (!response.ok) {
      console.warn('Failed to get Threads posts');
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching Threads posts:', error);
    return [];
  }
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

/**
 * Threadsアカウント情報を取得
 */
async function getThreadsAccountInfo(accessToken: string): Promise<{ id: string; username: string } | null> {
  try {
    const response = await fetch(
      `${GRAPH_BASE}/me?fields=id,username&access_token=${accessToken}`
    );

    if (!response.ok) return null;

    return await response.json();
  } catch {
    return null;
  }
}

/**
 * ユーザーのThreads投稿とコメントを同期
 */
async function syncUserPosts(
  userId: string,
  accessToken: string,
  threadsUserId: string,
  postLimit: number = 50
): Promise<{
  success: boolean;
  postsCount: number;
  newPosts: number;
  updatedPosts: number;
  commentsCount: number;
  newComments: number;
  updatedComments: number;
  error?: string;
}> {
  try {
    // アカウント情報取得（username取得のため）
    const accountInfo = await getThreadsAccountInfo(accessToken);
    if (!accountInfo) {
      return { success: false, postsCount: 0, newPosts: 0, updatedPosts: 0, commentsCount: 0, newComments: 0, updatedComments: 0, error: 'Failed to get account info' };
    }

    // 投稿一覧を取得（同期時は上限あり）
    const posts = await getThreadsPosts(accessToken, postLimit);

    if (posts.length === 0) {
      return { success: true, postsCount: 0, newPosts: 0, updatedPosts: 0, commentsCount: 0, newComments: 0, updatedComments: 0 };
    }

    // 各投稿のインサイトを並列取得（10件ずつバッチ処理でAPI制限を考慮）
    const postsWithInsights: ThreadsPost[] = [];
    const BATCH_SIZE = 10;

    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      const batch = posts.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (post) => {
          const insights = await getPostInsights(accessToken, post.id);
          return {
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
          } as ThreadsPost;
        })
      );
      postsWithInsights.push(...batchResults);
      // バッチ間にwait（API制限対策）
      if (i + BATCH_SIZE < posts.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // コメント取得は重すぎるので定期同期ではスキップ（オンボーディング時のみ取得）
    const allComments: ThreadsComment[] = [];

    // BigQueryに保存（upsert）
    let postsResult = { newCount: 0, updatedCount: 0 };
    let commentsResult = { newCount: 0, updatedCount: 0 };

    if (postsWithInsights.length > 0) {
      postsResult = await insertThreadsPosts(postsWithInsights);
    }

    if (allComments.length > 0) {
      try {
        commentsResult = await insertThreadsComments(allComments);
      } catch (e) {
        console.warn('コメント保存に失敗:', e);
      }
    }

    return {
      success: true,
      postsCount: postsWithInsights.length,
      newPosts: postsResult.newCount,
      updatedPosts: postsResult.updatedCount,
      commentsCount: allComments.length,
      newComments: commentsResult.newCount,
      updatedComments: commentsResult.updatedCount,
    };
  } catch (error) {
    console.error(`Error syncing Threads posts for user ${userId}:`, error);
    return {
      success: false,
      postsCount: 0,
      newPosts: 0,
      updatedPosts: 0,
      commentsCount: 0,
      newComments: 0,
      updatedComments: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * GET: Threads投稿を同期
 *
 * ■ スケーラブル設計:
 * - userId指定あり: そのユーザーのみ同期（1ユーザー=1サーバーレス関数で独立実行）
 * - userId指定なし: cron用ディスパッチャー。全ユーザーを取得し、各ユーザーごとに
 *   個別のHTTPリクエストを発行して並列同期。1関数で全ユーザーを処理しないため、
 *   ユーザーが500人でも1000人でもタイムアウトしない。
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');
    const limitParam = searchParams.get('limit');
    const rawLimit = limitParam ? parseInt(limitParam, 10) : NaN;
    const postLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 50;

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

      const result = await syncUserPosts(
        user.user_id,
        user.threads_access_token,
        user.threads_user_id,
        postLimit
      );

      return NextResponse.json({
        success: result.success,
        userId: user.user_id,
        username: user.threads_username,
        ...result,
      });
    }

    // ── ディスパッチャーモード（cron用） ──
    // 全ユーザーを取得して、各ユーザーに個別リクエストを並列発行
    const users = await getActiveThreadsUsers();
    const validUsers = users.filter(u => u.threads_access_token && u.threads_user_id);

    if (validUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active Threads users found',
        results: [],
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://analyca.jp';

    // 全ユーザーを並列で同期（各ユーザーが独立したサーバーレス関数で実行される）
    const syncPromises = validUsers.map(async (user) => {
      try {
        const res = await fetch(
          `${appUrl}/api/sync/threads/posts?userId=${encodeURIComponent(user.user_id)}&limit=${postLimit}`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        return {
          userId: user.user_id,
          username: user.threads_username,
          success: data.success ?? false,
          postsCount: data.postsCount ?? 0,
          error: data.error,
        };
      } catch (err) {
        return {
          userId: user.user_id,
          username: user.threads_username,
          success: false,
          postsCount: 0,
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
    console.error('Threads posts sync error:', error);
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

    const result = await syncUserPosts(userId, accessToken, threadsUserId);

    return NextResponse.json({
      success: result.success,
      postsCount: result.postsCount,
      commentsCount: result.commentsCount,
      error: result.error,
    });
  } catch (error) {
    console.error('Threads posts sync error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    }, { status: 500 });
  }
}
