import { NextRequest, NextResponse } from 'next/server';
import { getReadyDraftsForLine } from '@/lib/threads-content-drafts';
import { YOKO_ANALYCA_USER_ID } from '@/lib/yoko-notion-ledger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { userId?: string; draftIds?: string[] };
    if (body.userId !== YOKO_ANALYCA_USER_ID) {
      return NextResponse.json({ error: '対象外のアカウントです' }, { status: 403 });
    }
    const drafts = await getReadyDraftsForLine(body.draftIds);
    return NextResponse.json({
      destination: {
        name: '山路さん　サポートグループ',
        groupId: 'C4dfd78b05242f78ca28fddae7c88d861',
      },
      format: '1 Flex message / carousel / one bubble per draft / size giga',
      drafts,
      requiresExplicitApproval: true,
      sent: false,
    });
  } catch (error) {
    console.error('[threads/content-drafts/line-preview] failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'LINEプレビューの作成に失敗しました' }, { status: 500 });
  }
}
