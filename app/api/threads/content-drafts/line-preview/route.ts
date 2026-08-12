import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getYokoLinePreview, validateYokoLinePreview, YOKO_LINE_GROUP } from '@/lib/yoko-line-delivery';
import { YOKO_ANALYCA_USER_ID } from '@/lib/yoko-notion-ledger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { userId?: string; draftIds?: string[] };
    if (body.userId !== YOKO_ANALYCA_USER_ID) {
      return NextResponse.json({ error: '対象外のアカウントです' }, { status: 403 });
    }
    const drafts = await getYokoLinePreview(body.draftIds || []);
    const verifiedGroupName = await validateYokoLinePreview(drafts);
    return NextResponse.json({
      destination: { ...YOKO_LINE_GROUP, name: verifiedGroupName },
      format: '1 Flex message / carousel / one bubble per draft / size giga',
      drafts,
      requestId: randomUUID(),
      requiresExplicitApproval: true,
      sent: false,
    });
  } catch (error) {
    console.error('[threads/content-drafts/line-preview] failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'LINEプレビューの作成に失敗しました' }, { status: 500 });
  }
}
