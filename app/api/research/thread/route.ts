import { NextRequest, NextResponse } from 'next/server';
import { getUserById } from '@/lib/bigquery';
import { ThreadsConversationAPI } from '@/lib/threadsDiscovery';
import { isResearchAllowed } from '@/lib/research-access';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * The author's own reply chain under one post, fetched on demand.
 *
 * Kept separate from /api/research/profile so opening a profile stays fast: a popular
 * account's posts can carry hundreds of replies, and walking every conversation up
 * front took minutes. Here only the post the operator opened is fetched.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const userId = searchParams.get('userId');
  if (!isResearchAllowed(userId)) {
    return NextResponse.json({ error: '対象外のアカウントです' }, { status: 403 });
  }

  const postId = searchParams.get('postId');
  const username = (searchParams.get('username') || '').replace(/^@/, '').toLowerCase();
  if (!postId || !username) {
    return NextResponse.json({ error: 'postIdとusernameが必要です' }, { status: 400 });
  }

  const postedAt = searchParams.get('postedAt');

  try {
    const user = await getUserById(userId);
    const accessToken = user?.threads_access_token;
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Threadsのアクセストークンが見つかりません。再連携してください' },
        { status: 400 }
      );
    }

    const conversations = new ThreadsConversationAPI(accessToken);
    // 200 nodes covers the author's own chain on a normal post without walking
    // every page of a viral thread.
    const chain = await conversations.getSelfReplyChain(postId, username, 200);
    const rootTime = postedAt ? new Date(postedAt).getTime() : NaN;

    const replies = chain.map((node) => {
      const nodeTime = new Date(node.timestamp).getTime();
      return {
        text: node.text ?? '',
        depth: node.depth,
        permalink: node.permalink ?? '',
        secondsAfterRoot:
          Number.isFinite(rootTime) && Number.isFinite(nodeTime)
            ? Math.round((nodeTime - rootTime) / 1000)
            : null,
      };
    });

    return NextResponse.json({ replies });
  } catch (error) {
    console.error('[research/thread] failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '返信の取得に失敗しました' },
      { status: 500 }
    );
  }
}
