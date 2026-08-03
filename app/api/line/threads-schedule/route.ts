import { NextRequest, NextResponse } from 'next/server';
import { confirmThreadsScheduleApproval } from '@/lib/threadsScheduleApprovals';

const GUARDIAN_SEND_MESSAGE_URL =
  process.env.GUARDIAN_SEND_MESSAGE_URL
  || 'https://guardian-webhook-383002618526.asia-northeast1.run.app/send-message';

type LineEvent = {
  type?: string;
  postback?: { data?: string };
  source?: { type?: string; groupId?: string; roomId?: string };
};

function sourceId(event: LineEvent) {
  if (event.source?.type === 'group') return event.source.groupId || '';
  if (event.source?.type === 'room') return event.source.roomId || '';
  return '';
}

async function notifyLineGroup(groupId: string, message: string) {
  const response = await fetch(GUARDIAN_SEND_MESSAGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId, message }),
  });
  if (!response.ok) {
    throw new Error(`Guardian notification failed: ${response.status}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const events = Array.isArray(payload?.events) ? payload.events as LineEvent[] : [];
    const results = [];

    for (const event of events) {
      if (event.type !== 'postback') continue;
      const params = new URLSearchParams(event.postback?.data || '');
      if (params.get('action') !== 'threads_schedule') continue;

      const token = params.get('token') || '';
      const groupId = sourceId(event);
      if (!token || !groupId) {
        results.push({ ok: false, message: '予約情報が不足しています。' });
        continue;
      }

      const result = await confirmThreadsScheduleApproval(token, groupId);
      try {
        await notifyLineGroup(groupId, result.message);
      } catch (notificationError) {
        console.error('[line/threads-schedule] LINE notification failed', notificationError);
      }
      results.push(result);
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('[line/threads-schedule] failed', error);
    return NextResponse.json({ error: 'Failed to confirm Threads schedule' }, { status: 500 });
  }
}
