import { createHash } from 'node:crypto';
import { getReadyDraftsForLine, type ThreadsContentDraft } from '@/lib/threads-content-drafts';
import {
  getScheduledPostById,
  insertScheduledPost,
  listScheduledPosts,
} from '@/lib/bigqueryScheduledPosts';
import { createThreadsScheduleApproval } from '@/lib/threadsScheduleApprovals';
import { formatDateTimePickerValue } from '@/lib/threadsLineScheduling';
import { YOKO_ANALYCA_USER_ID } from '@/lib/yoko-notion-ledger';

export const YOKO_LINE_GROUP = {
  name: '山路さん　サポートグループ',
  groupId: 'C4dfd78b05242f78ca28fddae7c88d861',
} as const;

export type YokoLinePreviewDraft = ThreadsContentDraft & {
  candidateScheduledAtJst: string;
};

type LineMessage = Record<string, unknown> & { type: 'flex' };

function jstDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function addDays(date: string, amount: number) {
  const parsed = new Date(`${date}T00:00:00+09:00`);
  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return jstDateParts(parsed);
}

export function assignYokoLineCandidateDates(
  occupiedDates: string[],
  count: number,
  todayJst = jstDateParts(new Date()),
) {
  const occupied = new Set(occupiedDates);
  const latest = occupiedDates.filter((date) => date >= todayJst).sort().at(-1);
  let cursor = latest ? addDays(latest, 1) : addDays(todayJst, 1);
  const result: string[] = [];
  while (result.length < count) {
    if (!occupied.has(cursor)) result.push(`${cursor}T06:00:00+09:00`);
    cursor = addDays(cursor, 1);
  }
  return result;
}

function formatCandidateLabel(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function countText(value: string) {
  return Array.from(value.replace(/[\s\u3000]/g, '')).length;
}

function bodySection(label: string, value: string) {
  return [
    { type: 'text', text: `${label}｜${countText(value)}文字`, size: 'sm', weight: 'bold', color: '#6B4EFF' },
    { type: 'text', text: value, size: 'sm', wrap: true, color: '#222222', lineSpacing: '4px' },
  ];
}

export function buildYokoLineFlex(input: Array<{
  draft: ThreadsContentDraft;
  scheduledAtJst: string;
  scheduleToken: string;
  changeToken: string;
}>): LineMessage {
  const min = formatDateTimePickerValue(new Date(Date.now() + 60 * 1000));
  const max = formatDateTimePickerValue(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
  const bubbles = input.map((item, index) => ({
    type: 'bubble',
    size: 'giga',
    header: {
      type: 'box',
      layout: 'horizontal',
      backgroundColor: '#F3EEFF',
      paddingAll: '16px',
      contents: [
        { type: 'text', text: `投稿 #${String(index + 1).padStart(2, '0')}`, weight: 'bold', color: '#5B35D5', flex: 1 },
        { type: 'text', text: formatCandidateLabel(item.scheduledAtJst), weight: 'bold', color: '#5B35D5', align: 'end', flex: 1 },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'lg',
      paddingAll: '18px',
      contents: [
        ...bodySection('メイン投稿', item.draft.mainText),
        { type: 'separator', color: '#E5E7EB' },
        ...bodySection('コメント欄1', item.draft.comment1),
        { type: 'separator', color: '#E5E7EB' },
        ...bodySection('コメント欄2', item.draft.comment2),
      ],
    },
    footer: {
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      paddingAll: '14px',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#06C755',
          action: {
            type: 'postback',
            label: '予約',
            data: `action=threads_schedule&mode=schedule&token=${item.scheduleToken}`,
            displayText: `投稿${index + 1}を予約`,
          },
        },
        {
          type: 'button',
          style: 'secondary',
          action: {
            type: 'datetimepicker',
            label: '変更',
            data: `action=threads_schedule&mode=change&token=${item.changeToken}`,
            mode: 'datetime',
            initial: formatDateTimePickerValue(item.scheduledAtJst),
            min,
            max,
          },
        },
      ],
    },
  }));
  return {
    type: 'flex',
    altText: `Threads投稿案${input.length}件をご確認ください`,
    contents: { type: 'carousel', contents: bubbles },
  };
}

async function candidateDates(count: number) {
  const today = jstDateParts(new Date());
  const schedules = await listScheduledPosts(YOKO_ANALYCA_USER_ID, { startDate: today });
  const occupied = schedules
    .filter((schedule) => ['draft', 'scheduled', 'partial', 'processing', 'posted'].includes(schedule.status))
    .map((schedule) => schedule.scheduled_date);
  return assignYokoLineCandidateDates(occupied, count, today);
}

export async function getYokoLinePreview(draftIds: string[]): Promise<YokoLinePreviewDraft[]> {
  const drafts = await getReadyDraftsForLine(draftIds);
  const dates = await candidateDates(drafts.length);
  return drafts.map((draft, index) => ({
    ...draft,
    candidateScheduledAtJst: dates[index],
  }));
}

function scheduleId(requestId: string, draftId: string) {
  return `yoko-line-${createHash('sha256').update(`${requestId}:${draftId}`).digest('hex').slice(0, 24)}`;
}

export async function prepareYokoLineDelivery(draftIds: string[], requestId: string) {
  const drafts = await getReadyDraftsForLine(draftIds);
  const existingSchedules = await Promise.all(drafts.map((draft) => getScheduledPostById(scheduleId(requestId, draft.id))));
  const missingDates = await candidateDates(existingSchedules.filter((schedule) => !schedule).length);
  let missingDateIndex = 0;
  const items = [];
  for (let index = 0; index < drafts.length; index += 1) {
    const item = drafts[index];
    const id = scheduleId(requestId, item.id);
    let schedule = existingSchedules[index];
    if (!schedule) {
      const scheduledAtJst = missingDates[missingDateIndex];
      missingDateIndex += 1;
      schedule = await insertScheduledPost({
        scheduleId: id,
        userId: YOKO_ANALYCA_USER_ID,
        scheduledTimeIso: scheduledAtJst,
        status: 'draft',
        mainText: item.mainText,
        comment1: item.comment1,
        comment2: item.comment2,
      });
    }
    if (!schedule || schedule.status !== 'draft') {
      throw new Error(`投稿${item.number}の予約下書きを準備できませんでした`);
    }
    const scheduleToken = await createThreadsScheduleApproval({
      scheduleId: id,
      userId: YOKO_ANALYCA_USER_ID,
      groupId: YOKO_LINE_GROUP.groupId,
    });
    const changeToken = await createThreadsScheduleApproval({
      scheduleId: id,
      userId: YOKO_ANALYCA_USER_ID,
      groupId: YOKO_LINE_GROUP.groupId,
    });
    items.push({ draft: item, scheduleId: id, scheduledAtJst: schedule.scheduled_at_jst, scheduleToken, changeToken });
  }
  return { items, message: buildYokoLineFlex(items) };
}
