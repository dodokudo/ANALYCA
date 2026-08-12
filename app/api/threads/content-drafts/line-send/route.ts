import { NextRequest, NextResponse } from 'next/server';
import { linkThreadsContentDraftDelivery } from '@/lib/threads-content-drafts';
import { bindThreadsLineMessage, getThreadsLineGroupConfig } from '@/lib/threadsLineScheduling';
import { prepareYokoLineDelivery, YOKO_LINE_GROUP } from '@/lib/yoko-line-delivery';
import { YOKO_ANALYCA_USER_ID } from '@/lib/yoko-notion-ledger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const GUARDIAN_SEND_THREAD_MESSAGE_URL =
  process.env.GUARDIAN_SEND_THREAD_MESSAGE_URL
  || 'https://guardian-webhook-383002618526.asia-northeast1.run.app/send-thread-message';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { userId?: string; draftIds?: unknown; requestId?: string };
    if (body.userId !== YOKO_ANALYCA_USER_ID) {
      return NextResponse.json({ error: '対象外のアカウントです' }, { status: 403 });
    }
    const draftIds = Array.isArray(body.draftIds)
      ? body.draftIds.filter((value): value is string => typeof value === 'string' && !!value)
      : [];
    if (draftIds.length === 0) return NextResponse.json({ error: 'LINE送信対象がありません' }, { status: 400 });
    if (!body.requestId || !isUuid(body.requestId)) {
      return NextResponse.json({ error: '送信確認情報が無効です。プレビューを開き直してください。' }, { status: 400 });
    }
    const groupConfig = await getThreadsLineGroupConfig(YOKO_LINE_GROUP.groupId);
    if (!groupConfig || groupConfig.analycaUserId !== YOKO_ANALYCA_USER_ID) {
      return NextResponse.json({ error: '送信先グループの設定が無効です' }, { status: 503 });
    }

    const delivery = await prepareYokoLineDelivery(draftIds, body.requestId);
    const apiKey = process.env.THREADS_LINE_API_KEY || '';
    if (!apiKey) return NextResponse.json({ error: 'LINE送信APIが未設定です' }, { status: 503 });
    const response = await fetch(GUARDIAN_SEND_THREAD_MESSAGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        groupId: YOKO_LINE_GROUP.groupId,
        expectedGroupName: YOKO_LINE_GROUP.name,
        retryKey: body.requestId,
        messages: [delivery.message],
      }),
    });
    const sent = await response.json() as {
      success?: boolean;
      groupName?: string;
      sentMessages?: Array<{ id?: string }>;
      error?: string;
    };
    if (!response.ok || !sent.success) {
      throw new Error(sent.error || `LINE送信に失敗しました（${response.status}）`);
    }
    const lineMessageId = sent.sentMessages?.[0]?.id || '';
    if (!lineMessageId) throw new Error('LINE送信は成功しましたが、メッセージIDを取得できませんでした');

    await bindThreadsLineMessage({
      lineMessageId,
      groupId: YOKO_LINE_GROUP.groupId,
      analycaUserId: YOKO_ANALYCA_USER_ID,
      scheduleIds: delivery.items.map((item) => item.scheduleId),
    });
    const drafts = await Promise.all(delivery.items.map((item) => linkThreadsContentDraftDelivery({
      draftId: item.draft.id,
      scheduleId: item.scheduleId,
      lineMessageId,
    })));
    return NextResponse.json({
      sent: true,
      lineMessageId,
      groupName: sent.groupName || YOKO_LINE_GROUP.name,
      drafts,
    });
  } catch (error) {
    console.error('[threads/content-drafts/line-send] failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'LINE送信に失敗しました' }, { status: 500 });
  }
}
