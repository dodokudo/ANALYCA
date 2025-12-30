import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveThreadsUsers,
  insertThreadsComments,
  getUserThreadsPosts,
  ThreadsComment,
} from '@/lib/bigquery';
import { v4 as uuidv4 } from 'uuid';

// Vercel Functionの最大実行時間を延長
export const maxDuration = 300;

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
 * 投稿に対する返信を取得
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
 * 再帰的に全ての自分のコメントを取得
 */
async function getAllMyComments(
  accessToken: string,
  rootPostId: string,
  myUsername: string,
  startId: string,
  depth: number = 0,
  maxDepth: number = 10
): Promise<Array<ThreadsReply & { depth: number; rootPostId: string }>> {
  if (depth > maxDepth) return [];

  const allComments: Array<ThreadsReply & { depth: number; rootPostId: string }> = [];

  try {
    const replies = await getReplies(accessToken, startId);

    for (const reply of replies) {
      // 自分のコメントのみ追加
      if (reply.username === myUsername) {
        allComments.push({
          ...reply,
          depth,
          rootPostId,
        });

        // このコメントに返信がある場合、再帰的に取得
        if (reply.has_replies) {
          const nestedComments = await getAllMyComments(
            accessToken,
            rootPostId,
            myUsername,
            reply.id,
            depth + 1,
            maxDepth
          );
          allComments.push(...nestedComments);
        }
      }

      // API制限を考慮（軽めに）
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  } catch (e) {
    console.warn(`Error fetching replies for ${startId}:`, e);
  }

  return allComments;
}

/**
 * 特定ユーザーの全投稿のコメントを同期
 */
async function syncUserComments(
  userId: string,
  accessToken: string,
  postLimit: number = 100
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

    // BigQueryから投稿を取得
    const posts = await getUserThreadsPosts(userId, postLimit);

    if (posts.length === 0) {
      return { success: true, commentsCount: 0, newComments: 0 };
    }

    const allComments: ThreadsComment[] = [];

    // 各投稿の全コメントを再帰的に取得
    for (const post of posts) {
      const myComments = await getAllMyComments(
        accessToken,
        post.threads_id,
        accountInfo.username,
        post.threads_id,
        0
      );

      for (const comment of myComments) {
        allComments.push({
          id: uuidv4(),
          user_id: userId,
          comment_id: comment.id,
          parent_post_id: comment.rootPostId,
          text: comment.text || '',
          timestamp: new Date(comment.timestamp),
          permalink: comment.permalink,
          has_replies: comment.has_replies,
          views: 0, // viewsは別途取得（重いのでスキップ）
          depth: comment.depth,
        });
      }

      // 投稿間のAPI制限を考慮
      await new Promise(resolve => setTimeout(resolve, 100));
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
 * - userId指定なし: 全アクティブユーザーを同期（cron用）
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');
    const postLimit = parseInt(searchParams.get('limit') || '100', 10);

    // アクティブなThreadsユーザーを取得
    let users = await getActiveThreadsUsers();

    // userIdが指定されている場合、そのユーザーのみに絞る
    if (targetUserId) {
      users = users.filter(u => u.user_id === targetUserId);
    }

    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active Threads users found',
        results: [],
      });
    }

    const results: Array<{
      userId: string;
      username: string | null;
      success: boolean;
      commentsCount: number;
      newComments: number;
      error?: string;
    }> = [];

    // 各ユーザーのコメントを同期
    for (const user of users) {
      if (!user.threads_access_token) {
        results.push({
          userId: user.user_id,
          username: user.threads_username,
          success: false,
          commentsCount: 0,
          newComments: 0,
          error: 'Missing access token',
        });
        continue;
      }

      const result = await syncUserComments(
        user.user_id,
        user.threads_access_token,
        postLimit
      );

      results.push({
        userId: user.user_id,
        username: user.threads_username,
        ...result,
      });

      // ユーザー間のAPI制限を考慮
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const successCount = results.filter(r => r.success).length;
    const totalComments = results.reduce((sum, r) => sum + r.commentsCount, 0);

    return NextResponse.json({
      success: true,
      message: `Synced comments for ${successCount}/${users.length} users`,
      totalComments,
      results,
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
    const { userId, accessToken, postLimit = 100 } = body;

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
