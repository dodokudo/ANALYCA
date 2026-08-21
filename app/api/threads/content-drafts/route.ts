import { NextRequest, NextResponse } from 'next/server';
import {
  listThreadsContentDrafts,
  updateThreadsContentDraft,
  type ThreadsContentStatus,
} from '@/lib/threads-content-drafts';
import { YOKO_ANALYCA_USER_ID } from '@/lib/yoko-notion-ledger';

export const dynamic = 'force-dynamic';

function isYoko(userId: unknown): userId is string {
  return userId === YOKO_ANALYCA_USER_ID;
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!isYoko(userId)) return NextResponse.json({ error: '対象外のアカウントです' }, { status: 403 });
  try {
    const result = await listThreadsContentDrafts({
      status: (request.nextUrl.searchParams.get('status') || 'all') as ThreadsContentStatus | 'all',
      search: request.nextUrl.searchParams.get('search') || '',
      page: Number(request.nextUrl.searchParams.get('page') || 1),
      pageSize: Number(request.nextUrl.searchParams.get('pageSize') || 24),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[threads/content-drafts] list failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '投稿一覧の取得に失敗しました' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (!isYoko(body.userId)) return NextResponse.json({ error: '対象外のアカウントです' }, { status: 403 });
    if (typeof body.draftId !== 'string' || !body.draftId) {
      return NextResponse.json({ error: 'draftIdが必要です' }, { status: 400 });
    }
    const draft = await updateThreadsContentDraft({
      draftId: body.draftId,
      ...(typeof body.theme === 'string' ? { theme: body.theme } : {}),
      ...(typeof body.mainText === 'string' ? { mainText: body.mainText } : {}),
      ...(typeof body.comment1 === 'string' ? { comment1: body.comment1 } : {}),
      ...(typeof body.comment2 === 'string' ? { comment2: body.comment2 } : {}),
      ...(typeof body.status === 'string' ? { status: body.status as ThreadsContentStatus } : {}),
      ...(body.markSaved === true ? { markSaved: true } : {}),
      ...(body.preserveError === true ? { preserveError: true } : {}),
    });
    return NextResponse.json({ draft });
  } catch (error) {
    console.error('[threads/content-drafts] update failed', error);
    const message = error instanceof Error ? error.message : '投稿の更新に失敗しました';
    return NextResponse.json({ error: message }, { status: message.includes('変更できません') ? 409 : 500 });
  }
}
