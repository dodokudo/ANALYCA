import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveThreadsUsers,
  insertThreadsComments,
  getUserThreadsPosts,
  ThreadsComment,
} from '@/lib/bigquery';
import { v4 as uuidv4 } from 'uuid';

// Vercel Functionの最大実行時間を延長
export const maxDuration = 60;

const GRAPH_BASE = 'https://graph.threads.net/v1.0';

interface ThreadsReply {
  id: string;
  text: string;
  username: string;
  timestamp: string;
  permalink: string;
  has_replies: boolean;
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
 * 投稿に対する返信を取得（1レベルのみ）
 */
async function getReplies(accessToken: string, postId: string): Promise<ThreadsReply[]> {
  try {
    const response = await fetch(
      `${GRAPH_BASE}/${postId}/replies?fields=id,text,username,timestamp,permalink,has_replies&access_token=${accessToken}`
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
 * 特定ユーザーの最新投稿のコメントを同期
 */
async function syncUserComments(
  userId: string,
  accessToken: string,
  postLimit: number = 5
): Promise<{
  success: boolean;
  commentsCount: number;
  newComments: number;
  error?: string;
}> {
  try {
    // アカウント情報取得（username取得のため）
    const accountInfo = await getThreadsAccountInfo(accessToken);
    if (!accountInfo) {
      return { success: false, commentsCount: 0, newComments: 0, error: 'Failed to get account info' };
    }

    // BigQueryから最新の投稿を取得
    const posts = await getUserThreadsPosts(userId, postLimit);

    if (posts.length === 0) {
      return { success: true, commentsCount: 0, newComments: 0 };
    }

    const allComments: ThreadsComment[] = [];

    // 各投稿の1レベル目のコメントのみ取得（再帰なし）
    for (const post of posts) {
      const replies = await getReplies(accessToken, post.threads_id);

      // 自分のコメントのみフィルタ
      const myReplies = replies.filter(r => r.username === accountInfo.username);

      for (let i = 0; i < myReplies.length; i++) {
        const reply = myReplies[i];
        const views = await getCommentViews(accessToken, reply.id);

        allComments.push({
          id: uuidv4(),
          user_id: userId,
          comment_id: reply.id,
          parent_post_id: post.threads_id,
          text: reply.text || '',
          timestamp: new Date(reply.timestamp),
          permalink: reply.permalink,
          has_replies: reply.has_replies,
          views: views,
          depth: i, // 順番をdepthとして保存
        });
      }

      // API制限を考慮
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // BigQueryに保存
    let result = { newCount: 0, updatedCount: 0 };
    if (allComments.length > 0) {
      result = await insertThreadsComments(allComments);
    }

    return {
      success: true,
      commentsCount: allComments.length,
      newComments: result.newCount,
    };
  } catch (error) {
    console.error(`Error syncing comments for user ${userId}:`, error);
    return {
      success: false,
      commentsCount: 0,
      newComments: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * GET: コメントを同期
 * - userId指定あり: そのユーザーのみ同期
 * - limit: 同期する投稿数（デフォルト5）
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');
    const postLimit = parseInt(searchParams.get('limit') || '5', 10);

    if (!targetUserId) {
      return NextResponse.json({
        success: false,
        error: 'userId is required',
      }, { status: 400 });
    }

    // アクティブなThreadsユーザーを取得
    const users = await getActiveThreadsUsers();
    const user = users.find(u => u.user_id === targetUserId);

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found or not active',
      }, { status: 404 });
    }

    if (!user.threads_access_token) {
      return NextResponse.json({
        success: false,
        error: 'Missing access token',
      }, { status: 400 });
    }

    const result = await syncUserComments(
      user.user_id,
      user.threads_access_token,
      postLimit
    );

    return NextResponse.json({
      success: result.success,
      userId: user.user_id,
      username: user.threads_username,
      commentsCount: result.commentsCount,
      newComments: result.newComments,
      error: result.error,
    });
  } catch (error) {
    console.error('Threads comments sync error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, accessToken, postLimit = 5 } = body;

    if (!userId || !accessToken) {
      return NextResponse.json({
        success: false,
        error: 'userId and accessToken are required',
      }, { status: 400 });
    }

    const result = await syncUserComments(userId, accessToken, postLimit);

    return NextResponse.json({
      success: result.success,
      commentsCount: result.commentsCount,
      newComments: result.newComments,
      error: result.error,
    });
  } catch (error) {
    console.error('Threads comments sync error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    }, { status: 500 });
  }
}
