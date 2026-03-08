import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveThreadsUsers,
  insertThreadsComments,
  getUserThreadsPosts,
  ThreadsComment,
} from '@/lib/bigquery';
import { v4 as uuidv4 } from 'uuid';

// コメント同期は再帰的で重い。各ユーザー独立実行で300秒あれば十分
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

interface CommentWithMeta extends ThreadsReply {
  depth: number;
  rootPostId: string;
  views: number;
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
    if (!response.ok) return [];
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
    if (!response.ok) return 0;
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
 * 再帰的に全ての自分のコメントを取得（views込み）
 */
async function getAllMyComments(
  accessToken: string,
  rootPostId: string,
  myUsername: string,
  startId: string,
  depth: number = 0,
  maxDepth: number = 10
): Promise<CommentWithMeta[]> {
  if (depth > maxDepth) return [];

  const allComments: CommentWithMeta[] = [];

  try {
    const replies = await getReplies(accessToken, startId);

    for (const reply of replies) {
      if (reply.username === myUsername) {
        // 自分のコメント: viewsを取得して追加
        const views = await getCommentViews(accessToken, reply.id);

        allComments.push({
          ...reply,
          depth,
          rootPostId,
          views,
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
      } else if (reply.has_replies) {
        // 他人のコメントにも自分のネスト返信がある可能性があるので再帰
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

      // API制限を考慮（Threads APIはレートリミットに余裕あり）
      await new Promise(resolve => setTimeout(resolve, 30));
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
    const accountInfo = await getThreadsAccountInfo(accessToken);
    if (!accountInfo) {
      return { success: false, commentsCount: 0, newComments: 0, error: 'Failed to get account info' };
    }

    const posts = await getUserThreadsPosts(userId, postLimit);
    if (posts.length === 0) {
      return { success: true, commentsCount: 0, newComments: 0 };
    }

    const allComments: ThreadsComment[] = [];

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
          views: comment.views,
          depth: comment.depth,
        });
      }

      // 投稿間のAPI制限を考慮
      await new Promise(resolve => setTimeout(resolve, 50));
    }

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
 * - userId指定あり: そのユーザーのみ同期（独立実行）
 * - userId指定なし: ディスパッチャー。各ユーザーに個別リクエストを並列発行
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');
    const postLimit = parseInt(searchParams.get('limit') || '100', 10);

    // ── 単一ユーザー同期モード ──
    if (targetUserId) {
      const users = await getActiveThreadsUsers();
      const user = users.find(u => u.user_id === targetUserId);

      if (!user || !user.threads_access_token) {
        return NextResponse.json({ success: false, error: 'User not found or missing token' }, { status: 404 });
      }

      const result = await syncUserComments(user.user_id, user.threads_access_token, postLimit);

      return NextResponse.json({
        success: result.success,
        userId: user.user_id,
        username: user.threads_username,
        ...result,
      });
    }

    // ── ディスパッチャーモード（cron用） ──
    const users = await getActiveThreadsUsers();
    const validUsers = users.filter(u => u.threads_access_token);

    if (validUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active Threads users found',
        results: [],
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://analyca.jp';

    const syncPromises = validUsers.map(async (user) => {
      try {
        const res = await fetch(
          `${appUrl}/api/sync/threads/comments?userId=${encodeURIComponent(user.user_id)}&limit=${postLimit}`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        return {
          userId: user.user_id,
          username: user.threads_username,
          success: data.success ?? false,
          commentsCount: data.commentsCount ?? 0,
          error: data.error,
        };
      } catch (err) {
        return {
          userId: user.user_id,
          username: user.threads_username,
          success: false,
          commentsCount: 0,
          error: err instanceof Error ? err.message : 'Dispatch failed',
        };
      }
    });

    const results = await Promise.all(syncPromises);
    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      message: `Dispatched comment sync for ${successCount}/${validUsers.length} users`,
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
