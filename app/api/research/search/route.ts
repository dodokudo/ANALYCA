import { NextRequest, NextResponse } from 'next/server';
import { getUserById } from '@/lib/bigquery';
import { ThreadsDiscoveryAPI } from '@/lib/threadsDiscovery';
import { isResearchAllowed } from '@/lib/research-access';

export const dynamic = 'force-dynamic';

/**
 * Keyword discovery: find posts by keyword or topic tag, and the accounts behind them.
 *
 * Under Standard Access this searches only the authenticated user's own posts;
 * after App Review approval the same call searches public posts. The response shape
 * is identical either way, so nothing about the UI changes when approval lands.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const userId = searchParams.get('userId');
  if (!isResearchAllowed(userId)) {
    return NextResponse.json({ error: '対象外のアカウントです' }, { status: 403 });
  }

  const keyword = (searchParams.get('q') || '').trim();
  if (!keyword) {
    return NextResponse.json({ error: 'キーワードを入力してください' }, { status: 400 });
  }

  try {
    const user = await getUserById(userId);
    const accessToken = user?.threads_access_token;
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Threadsのアクセストークンが見つかりません。再連携してください' },
        { status: 400 }
      );
    }

    const discovery = new ThreadsDiscoveryAPI(accessToken);
    const searchMode = searchParams.get('mode') === 'TAG' ? 'TAG' : 'KEYWORD';
    const searchType = searchParams.get('sort') === 'RECENT' ? 'RECENT' : 'TOP';

    const posts = await discovery.keywordSearch(keyword, {
      searchMode,
      searchType,
      limit: 50,
    });

    // Rank the accounts behind the results so the operator can act on them directly.
    const counts = new Map<string, number>();
    for (const post of posts) {
      if (!post.username) continue;
      counts.set(post.username, (counts.get(post.username) || 0) + 1);
    }
    const authors = [...counts.entries()]
      .map(([username, postCount]) => ({ username, postCount }))
      .sort((a, b) => b.postCount - a.postCount);

    return NextResponse.json({ keyword, searchMode, searchType, posts, authors });
  } catch (error) {
    console.error('[research/search] failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '検索に失敗しました' },
      { status: 500 }
    );
  }
}
