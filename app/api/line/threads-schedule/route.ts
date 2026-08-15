import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  confirmThreadsScheduleApproval,
  createThreadsScheduleApproval,
} from '@/lib/threadsScheduleApprovals';
import {
  extractThreadsCommandLine,
  findThreadsLineBinding,
  formatDateTimePickerValue,
  formatScheduledAtJst,
  getThreadsLineGroupConfig,
  isThreadsLineOperator,
  listRecentDraftPosts,
  listUpcomingScheduledPosts,
  parseThreadsScheduleCommand,
  scheduleDraftAt,
  type ThreadsLineGroupConfig,
} from '@/lib/threadsLineScheduling';
import type { ScheduledPostRow } from '@/lib/bigqueryScheduledPosts';

const GUARDIAN_SEND_THREAD_MESSAGE_URL =
  process.env.GUARDIAN_SEND_THREAD_MESSAGE_URL
  || 'https://guardian-webhook-383002618526.asia-northeast1.run.app/send-thread-message';

type LineEvent = {
  type?: string;
  replyToken?: string;
  postback?: {
    data?: string;
    params?: { datetime?: string };
  };
  message?: {
    type?: string;
    text?: string;
    quotedMessageId?: string;
    mention?: {
      mentionees?: Array<{
        userId?: string;
        index?: number;
        length?: number;
      }>;
    };
  };
  source?: {
    type?: string;
    groupId?: string;
    roomId?: string;
    userId?: string;
  };
};

type LineMessage = Record<string, unknown> & { type: 'text' | 'flex' };

function sourceId(event: LineEvent) {
  if (event.source?.type === 'group') return event.source.groupId || '';
  if (event.source?.type === 'room') return event.source.roomId || '';
  return '';
}

function authorized(request: NextRequest) {
  const expected = process.env.THREADS_LINE_API_KEY || '';
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!expected || !supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

async function sendLineMessages(
  groupId: string,
  messages: LineMessage[],
  replyToken?: string,
) {
  const apiKey = process.env.THREADS_LINE_API_KEY || '';
  const response = await fetch(GUARDIAN_SEND_THREAD_MESSAGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ groupId, messages, replyToken }),
  });
  if (!response.ok) {
    throw new Error(`Guardian Threads notification failed: ${response.status}`);
  }
}

function textMessage(text: string): LineMessage {
  return { type: 'text', text };
}

function buildChangeConfirmationMessage(token: string, scheduledTimeIso: string): LineMessage {
  const confirmData = new URLSearchParams({
    action: 'threads_schedule',
    mode: 'change',
    confirm: '1',
    token,
    scheduledTime: scheduledTimeIso,
  }).toString();
  const cancelData = new URLSearchParams({
    action: 'threads_schedule',
    mode: 'cancel_change',
    token,
  }).toString();
  return {
    type: 'flex',
    altText: 'Threads予約変更の最終確認',
    contents: {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '18px',
        contents: [
          { type: 'text', text: '予約日時を変更しますか？', weight: 'bold', wrap: true },
          { type: 'text', text: formatScheduledAtJst(scheduledTimeIso), size: 'lg', weight: 'bold', color: '#8A6A2F' },
          { type: 'text', text: '「変更を確定」を押すまで予約日時は変わりません。', size: 'sm', color: '#666666', wrap: true },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '14px',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#9A7437',
            action: { type: 'postback', label: '変更を確定', data: confirmData },
          },
          {
            type: 'button',
            style: 'secondary',
            action: { type: 'postback', label: 'キャンセル', data: cancelData },
          },
        ],
      },
    },
  };
}

function preview(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > 78 ? `${normalized.slice(0, 78)}…` : normalized;
}

function datePickerBounds() {
  const min = new Date(Date.now() + 60 * 1000);
  const max = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  return {
    min: formatDateTimePickerValue(min),
    max: formatDateTimePickerValue(max),
  };
}

async function buildChangeListMessage(
  groupId: string,
  config: ThreadsLineGroupConfig,
  posts: ScheduledPostRow[],
): Promise<LineMessage> {
  const bounds = datePickerBounds();
  const bubbles = await Promise.all(posts.map(async (post, index) => {
    const token = await createThreadsScheduleApproval({
      scheduleId: post.schedule_id,
      userId: config.analycaUserId,
      groupId,
    });
    return {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#2F3A33',
        paddingAll: '14px',
        contents: [{
          type: 'text',
          text: `投稿 #${String(index + 1).padStart(2, '0')}`,
          weight: 'bold',
          color: '#FFFFFF',
        }],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '14px',
        contents: [
          {
            type: 'text',
            text: formatScheduledAtJst(post.scheduled_time),
            weight: 'bold',
            color: '#8A6A2F',
          },
          {
            type: 'text',
            text: preview(post.main_text),
            size: 'sm',
            wrap: true,
            color: '#222222',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '12px',
        contents: [{
          type: 'button',
          style: 'primary',
          color: '#9A7437',
          action: {
            type: 'datetimepicker',
            label: '予約日時を変更',
            data: `action=threads_schedule&mode=change&token=${token}`,
            mode: 'datetime',
            initial: formatDateTimePickerValue(post.scheduled_time),
            min: bounds.min,
            max: bounds.max,
          },
        }],
      },
    };
  }));

  return {
    type: 'flex',
    altText: 'Threads予約変更：対象の投稿を選択してください',
    contents: { type: 'carousel', contents: bubbles },
  };
}

async function resolveDraftTarget(
  event: LineEvent,
  config: ThreadsLineGroupConfig,
  postNumber?: number,
) {
  const groupId = sourceId(event);
  const quotedMessageId = event.message?.quotedMessageId;
  if (quotedMessageId) {
    const bindings = await findThreadsLineBinding(groupId, quotedMessageId, postNumber);
    const valid = bindings.filter((binding) => binding.analycaUserId === config.analycaUserId);
    if (valid.length === 1) return valid[0].scheduleId;
  }

  const drafts = await listRecentDraftPosts(config.analycaUserId);
  if (postNumber !== undefined) return drafts[postNumber - 1]?.schedule_id;
  if (drafts.length === 1) return drafts[0].schedule_id;
  return undefined;
}

async function handleMessageEvent(
  event: LineEvent,
  groupId: string,
  config: ThreadsLineGroupConfig,
) {
  const commandLine = extractThreadsCommandLine(event.message || {});
  if (commandLine === '投稿変更') {
    const posts = await listUpcomingScheduledPosts(config.analycaUserId);
    if (posts.length === 0) {
      await sendLineMessages(groupId, [textMessage('変更できる予約投稿はありません。')], event.replyToken);
      return { ok: false, message: 'no scheduled posts' };
    }
    const message = await buildChangeListMessage(groupId, config, posts);
    await sendLineMessages(groupId, [message], event.replyToken);
    return { ok: true, message: `${posts.length}件の予約変更候補を表示しました。` };
  }

  const parsed = parseThreadsScheduleCommand(commandLine);
  if (!parsed) {
    await sendLineMessages(
      groupId,
      [textMessage('形式を確認してください。例：5日6時3分 投稿')],
      event.replyToken,
    );
    return { ok: false, message: 'invalid command' };
  }

  const scheduleId = await resolveDraftTarget(event, config, parsed.postNumber);
  if (!scheduleId) {
    const drafts = await listRecentDraftPosts(config.analycaUserId);
    const message = drafts.length > 1
      ? `予約待ち投稿が${drafts.length}件あります。「5日6時3分 投稿1」のように投稿番号を指定してください。`
      : '予約対象の下書きが見つかりませんでした。';
    await sendLineMessages(groupId, [textMessage(message)], event.replyToken);
    return { ok: false, message };
  }

  const result = await scheduleDraftAt(scheduleId, config.analycaUserId, parsed.scheduledTimeIso);
  await sendLineMessages(groupId, [textMessage(result.message)], event.replyToken);
  return {
    ...result,
    scheduleId: result.post?.schedule_id,
    scheduledAtJst: result.post ? formatScheduledAtJst(result.post.scheduled_time) : undefined,
  };
}

async function handlePostbackEvent(event: LineEvent, groupId: string) {
  const params = new URLSearchParams(event.postback?.data || '');
  const token = params.get('token') || '';
  const requestedMode = params.get('mode');
  if (requestedMode === 'cancel_change') {
    await sendLineMessages(groupId, [textMessage('予約変更をキャンセルしました。')], event.replyToken);
    return { ok: true, cancelled: true, message: '予約変更をキャンセルしました。' };
  }
  const mode = requestedMode === 'change' ? 'change' : 'schedule';
  const confirmed = params.get('confirm') === '1';
  const dateTime = event.postback?.params?.datetime;
  const confirmedTime = params.get('scheduledTime');
  const requestedDate = dateTime
    ? new Date(`${dateTime}:00+09:00`)
    : confirmedTime
      ? new Date(confirmedTime)
      : undefined;
  const requestedTimeIso = requestedDate && !Number.isNaN(requestedDate.getTime())
    ? requestedDate.toISOString()
    : undefined;
  if (!token) return { ok: false, message: '予約情報が不足しています。' };
  if (dateTime && !requestedTimeIso) {
    return { ok: false, message: '予約日時を読み取れませんでした。' };
  }
  if (mode === 'change' && dateTime && !confirmed && requestedTimeIso) {
    await sendLineMessages(
      groupId,
      [buildChangeConfirmationMessage(token, requestedTimeIso)],
      event.replyToken,
    );
    return { ok: true, pendingConfirmation: true, message: '予約変更の確認待ちです。' };
  }
  if (mode === 'change' && (!confirmed || !requestedTimeIso)) {
    return { ok: false, message: '予約変更の確認情報が不足しています。もう一度変更日時を選択してください。' };
  }
  const result = await confirmThreadsScheduleApproval(token, groupId, {
    requestedTimeIso,
    mode,
  });
  await sendLineMessages(groupId, [textMessage(result.message)], event.replyToken);
  return result;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const events = Array.isArray(payload?.events) ? payload.events as LineEvent[] : [];
    const results = [];

    for (const event of events) {
      const groupId = sourceId(event);
      const actorUserId = event.source?.userId || '';
      if (!groupId || !actorUserId) {
        results.push({ ok: false, ignored: true, reason: 'missing source' });
        continue;
      }
      const config = await getThreadsLineGroupConfig(groupId);
      if (!config || !isThreadsLineOperator(config, actorUserId)) {
        console.warn('[line/threads-schedule] ignored unauthorized actor', { groupId, actorUserId });
        results.push({ ok: false, ignored: true, reason: 'unauthorized operator' });
        continue;
      }

      if (event.type === 'postback') {
        const result = await handlePostbackEvent(event, groupId);
        console.info('[line/threads-schedule] postback handled', {
          groupId,
          actorUserId,
          ok: result.ok,
          scheduleId: 'scheduleId' in result ? result.scheduleId : undefined,
          pendingConfirmation: 'pendingConfirmation' in result ? result.pendingConfirmation : false,
          cancelled: 'cancelled' in result ? result.cancelled : false,
        });
        results.push(result);
      } else if (event.type === 'message' && event.message?.type === 'text') {
        results.push(await handleMessageEvent(event, groupId, config));
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('[line/threads-schedule] failed', error);
    return NextResponse.json({ error: 'Failed to process Threads schedule command' }, { status: 500 });
  }
}
