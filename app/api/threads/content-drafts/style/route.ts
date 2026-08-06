import { NextRequest, NextResponse } from 'next/server';
import {
  styleYokoDrafts,
  type ThreadsContentField,
} from '@/lib/threads-content-drafts';
import { YOKO_ANALYCA_USER_ID } from '@/lib/yoko-notion-ledger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ALLOWED_FIELDS = new Set<ThreadsContentField>(['main_text', 'comment1', 'comment2']);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { userId?: string; draftIds?: unknown; fields?: unknown };
    if (body.userId !== YOKO_ANALYCA_USER_ID) {
      return NextResponse.json({ error: '対象外のアカウントです' }, { status: 403 });
    }
    const draftIds = Array.isArray(body.draftIds)
      ? body.draftIds.filter((value): value is string => typeof value === 'string' && !!value)
      : [];
    const fields = Array.isArray(body.fields)
      ? body.fields.filter((value): value is ThreadsContentField => typeof value === 'string' && ALLOWED_FIELDS.has(value as ThreadsContentField))
      : [];
    if (draftIds.length === 0) return NextResponse.json({ error: '採用済み投稿を選んでください' }, { status: 400 });
    const drafts = await styleYokoDrafts({ draftIds, fields });
    return NextResponse.json({ drafts });
  } catch (error) {
    console.error('[threads/content-drafts/style] failed', error);
    const rawMessage = error instanceof Error ? error.message : '本人文体への調整に失敗しました';
    const message = rawMessage.includes('OPENAI_API_KEY') ? 'OpenAI APIキーが未設定です' : rawMessage;
    return NextResponse.json({ error: message }, { status: rawMessage.includes('OPENAI_API_KEY') ? 503 : 500 });
  }
}
