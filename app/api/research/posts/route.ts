import { NextRequest, NextResponse } from 'next/server';
import { getInsights, getPosts, getThreadNodes } from '@/lib/research';
import { isResearchAllowed } from '@/lib/research-access';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const userId = searchParams.get('userId');
  if (!isResearchAllowed(userId)) {
    return NextResponse.json({ error: '対象外のアカウントです' }, { status: 403 });
  }

  const rootPostId = searchParams.get('postId');
  const username = searchParams.get('username') || undefined;

  try {
    // A postId asks for one thread; otherwise return the list plus its aggregates.
    if (rootPostId) {
      const nodes = await getThreadNodes(userId, rootPostId);
      return NextResponse.json({ nodes });
    }

    const [posts, insights] = await Promise.all([
      getPosts(userId, {
        username,
        limit: Number(searchParams.get('limit') || 100),
        treeOnly: searchParams.get('treeOnly') === 'true',
      }),
      getInsights(userId, username),
    ]);

    return NextResponse.json({ posts, insights });
  } catch (error) {
    console.error('[research/posts] failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '取得に失敗しました' },
      { status: 500 }
    );
  }
}
