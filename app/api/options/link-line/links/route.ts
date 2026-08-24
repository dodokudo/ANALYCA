import { NextRequest, NextResponse } from 'next/server';
import {
  createOptionShortLink,
  getLinkLineOptionRecord,
  listOptionShortLinks,
  userHasLinkLineOptionAccess,
} from '@/lib/link-line-option';

async function requireOptionAccess(userId: string): Promise<boolean> {
  return userHasLinkLineOptionAccess(userId, await getLinkLineOptionRecord(userId));
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')?.trim();
  if (!userId) {
    return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
  }
  if (!await requireOptionAccess(userId)) {
    return NextResponse.json(
      { success: false, error: 'この機能を使うにはオプション契約が必要です' },
      { status: 403 },
    );
  }

  try {
    return NextResponse.json({ success: true, links: await listOptionShortLinks(userId) });
  } catch (error) {
    console.error('[link-line-option/links] list failed:', error);
    return NextResponse.json(
      { success: false, error: 'リンク一覧の取得に失敗しました' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }
    if (!await requireOptionAccess(userId)) {
      return NextResponse.json(
        { success: false, error: 'この機能を使うにはオプション契約が必要です' },
        { status: 403 },
      );
    }

    const link = await createOptionShortLink({
      userId,
      slug: String(body?.slug || ''),
      managementName: typeof body?.managementName === 'string' ? body.managementName : null,
      destinationUrl: String(body?.destinationUrl || ''),
      title: typeof body?.title === 'string' ? body.title : null,
      description: typeof body?.description === 'string' ? body.description : null,
      ogpImageUrl: typeof body?.ogpImageUrl === 'string' ? body.ogpImageUrl : null,
    });
    return NextResponse.json({ success: true, link }, { status: 201 });
  } catch (error) {
    console.error('[link-line-option/links] create failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'リンク登録に失敗しました',
      },
      { status: 400 },
    );
  }
}
