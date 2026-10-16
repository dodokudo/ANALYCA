import { type NextRequest, NextResponse } from 'next/server';
import { generateYokoDraftBatch } from '@/lib/threads-content-drafts';
import { YOKO_ANALYCA_USER_ID } from '@/lib/yoko-notion-ledger';
import { syncYokoNotionContentBatch } from '@/lib/yoko-notion-sync';
import { YokoNotionError, yokoNotionSyncErrorMessage } from '@/lib/yoko-notion-errors';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { userId?: string };
    if (body.userId !== YOKO_ANALYCA_USER_ID) {
      return NextResponse.json({ error: '対象外のアカウントです' }, { status: 403 });
    }
    try {
      const notionSync = await syncYokoNotionContentBatch('instagram_script', 25);
      console.info('[threads/content-drafts/generate] Notion sync completed', {
        processed: notionSync.processed,
        remaining: notionSync.remaining,
        complete: notionSync.complete,
      });
    } catch (syncError) {
      console.error('[threads/content-drafts/generate] Notion sync failed', syncError);
      return NextResponse.json({
        error: yokoNotionSyncErrorMessage(syncError),
      }, { status: 502 });
    }
    const drafts = await generateYokoDraftBatch(6);
    return NextResponse.json({ drafts });
  } catch (error) {
    console.error('[threads/content-drafts/generate] failed', error);
    if (error instanceof YokoNotionError) {
      return NextResponse.json({ error: yokoNotionSyncErrorMessage(error) }, { status: 502 });
    }
    const rawMessage = error instanceof Error ? error.message : '投稿作成に失敗しました';
    const message = rawMessage.includes('OPENAI_API_KEY') ? 'OpenAI APIキーが未設定です' : rawMessage;
    const status = rawMessage.includes('OPENAI_API_KEY') ? 503 : message.includes('未使用台本') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
