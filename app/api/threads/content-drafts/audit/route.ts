import { NextRequest, NextResponse } from 'next/server';
import { auditSavedYokoDraft } from '@/lib/threads-content-drafts';
import { YOKO_ANALYCA_USER_ID } from '@/lib/yoko-notion-ledger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { userId?: string; draftId?: string };
    if (body.userId !== YOKO_ANALYCA_USER_ID) {
      return NextResponse.json({ error: '対象外のアカウントです' }, { status: 403 });
    }
    if (!body.draftId) {
      return NextResponse.json({ error: 'draftIdが必要です' }, { status: 400 });
    }
    const draft = await auditSavedYokoDraft(body.draftId);
    return NextResponse.json({ draft });
  } catch (error) {
    console.error('[threads/content-drafts/audit] failed', error);
    const rawMessage = error instanceof Error ? error.message : '修正稿の監査に失敗しました';
    const message = rawMessage.includes('OPENAI_API_KEY') ? 'OpenAI APIキーが未設定です' : rawMessage;
    return NextResponse.json({ error: message }, { status: rawMessage.includes('OPENAI_API_KEY') ? 503 : 500 });
  }
}
