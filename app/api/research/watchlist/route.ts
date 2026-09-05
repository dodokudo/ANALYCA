import { NextRequest, NextResponse } from 'next/server';
import {
  addToWatchlist,
  getAccountSummaries,
  listWatchlist,
  normalizeUsername,
  removeFromWatchlist,
} from '@/lib/research';
import { isResearchAllowed } from '@/lib/research-access';

export const dynamic = 'force-dynamic';

const FORBIDDEN = NextResponse.json({ error: '対象外のアカウントです' }, { status: 403 });

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!isResearchAllowed(userId)) return FORBIDDEN;

  try {
    const [watchlist, summaries] = await Promise.all([
      listWatchlist(userId),
      getAccountSummaries(userId),
    ]);
    return NextResponse.json({ watchlist, summaries });
  } catch (error) {
    console.error('[research/watchlist] list failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (!isResearchAllowed(body.userId)) return FORBIDDEN;

    const raw = typeof body.username === 'string' ? body.username : '';
    const username = normalizeUsername(raw);
    if (!username) {
      return NextResponse.json({ error: 'usernameが必要です' }, { status: 400 });
    }

    await addToWatchlist(
      body.userId,
      username,
      typeof body.note === 'string' ? body.note : ''
    );
    return NextResponse.json({ username });
  } catch (error) {
    console.error('[research/watchlist] add failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '追加に失敗しました' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  const username = request.nextUrl.searchParams.get('username');
  if (!isResearchAllowed(userId)) return FORBIDDEN;
  if (!username) {
    return NextResponse.json({ error: 'usernameが必要です' }, { status: 400 });
  }

  try {
    await removeFromWatchlist(userId, username);
    return NextResponse.json({ username: normalizeUsername(username) });
  } catch (error) {
    console.error('[research/watchlist] delete failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '削除に失敗しました' },
      { status: 500 }
    );
  }
}
