import { BigQuery } from '@google-cloud/bigquery';
import {
  getScheduledPostById,
  type ScheduledPostRow,
} from '@/lib/bigqueryScheduledPosts';

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID;
const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS || '{}';

function parseCredentials(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

const client = new BigQuery({
  projectId,
  credentials: parseCredentials(credentialsJson),
});

const DATASET = 'analyca';
const CONFIG_TABLE = 'threads_line_group_configs';
const BINDINGS_TABLE = 'threads_line_message_bindings';
const BOT_USER_ID = 'Ucdaaa14396462f82af6cd6a27c4b750b';
const COLLISION_WINDOW_MINUTES = 15;

const CONFIG_SCHEMA = [
  { name: 'group_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'analyca_user_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'operator_line_user_ids', type: 'STRING', mode: 'REQUIRED' },
  { name: 'active', type: 'BOOLEAN', mode: 'REQUIRED' },
  { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
  { name: 'updated_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
];

const BINDINGS_SCHEMA = [
  { name: 'line_message_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'group_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'schedule_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'analyca_user_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'card_index', type: 'INTEGER', mode: 'REQUIRED' },
  { name: 'card_count', type: 'INTEGER', mode: 'REQUIRED' },
  { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
];

export type ThreadsLineGroupConfig = {
  groupId: string;
  analycaUserId: string;
  operatorLineUserIds: string[];
};

export type ParsedThreadsScheduleCommand = {
  scheduledTimeIso: string;
  postNumber?: number;
};

export type ThreadsScheduleMutationResult = {
  ok: boolean;
  message: string;
  post?: ScheduledPostRow;
};

type LineTextMessage = {
  type?: string;
  text?: string;
  mention?: {
    mentionees?: Array<{
      userId?: string;
      index?: number;
      length?: number;
    }>;
  };
};

async function ensureTable(tableName: string, schema: typeof CONFIG_SCHEMA | typeof BINDINGS_SCHEMA) {
  const table = client.dataset(DATASET).table(tableName);
  const [exists] = await table.exists();
  if (exists) return;
  try {
    await client.dataset(DATASET).createTable(tableName, { schema });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('Already Exists')) throw error;
  }
}

function plain(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object' && 'value' in value) {
    return String((value as { value?: unknown }).value ?? '');
  }
  return String(value ?? '');
}

export async function getThreadsLineGroupConfig(groupId: string): Promise<ThreadsLineGroupConfig | undefined> {
  await ensureTable(CONFIG_TABLE, CONFIG_SCHEMA);
  const [rows] = await client.query({
    query: `
      SELECT group_id, analyca_user_id, operator_line_user_ids
      FROM \`${projectId}.${DATASET}.${CONFIG_TABLE}\`
      WHERE group_id = @groupId AND active = TRUE
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    params: { groupId },
  });
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return undefined;
  let operatorLineUserIds: string[] = [];
  try {
    const parsed = JSON.parse(plain(row.operator_line_user_ids));
    if (Array.isArray(parsed)) {
      operatorLineUserIds = parsed.filter((value): value is string => typeof value === 'string');
    }
  } catch {
    operatorLineUserIds = [];
  }
  return {
    groupId: plain(row.group_id),
    analycaUserId: plain(row.analyca_user_id),
    operatorLineUserIds,
  };
}

export function isThreadsLineOperator(config: ThreadsLineGroupConfig, lineUserId: string) {
  return Boolean(lineUserId && config.operatorLineUserIds.includes(lineUserId));
}

export function extractThreadsCommandLine(message: LineTextMessage): string {
  if (message.type !== 'text' || typeof message.text !== 'string') return '';
  const mention = (message.mention?.mentionees || [])
    .filter((item) => (
      item.userId === BOT_USER_ID
      && Number.isInteger(item.index)
      && Number.isInteger(item.length)
    ))
    .sort((a, b) => Number(a.index) - Number(b.index))
    .at(-1);
  if (!mention) return '';
  const commandText = message.text.slice(Number(mention.index) + Number(mention.length)).trim();
  const firstLine = commandText.split(/\r?\n/).find((line) => line.trim());
  return (firstLine || '').trim().replace(/[ \t　]+/g, ' ');
}

function jstParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
  };
}

function addCalendarDays(year: number, month: number, day: number, amount: number) {
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function nextMonth(year: number, month: number) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

function toJstDate(year: number, month: number, day: number, hour: number, minute: number) {
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return undefined;
  const check = jstParts(parsed);
  if (
    check.year !== year
    || check.month !== month
    || check.day !== day
    || check.hour !== hour
    || check.minute !== minute
  ) {
    return undefined;
  }
  return parsed;
}

export function parseThreadsScheduleCommand(
  commandLine: string,
  now = new Date(),
): ParsedThreadsScheduleCommand | undefined {
  const normalized = commandLine.trim().replace(/[ \t　]+/g, ' ');
  const date = '(?:(\\d{1,2})月)?(\\d{1,2})日|(今日|明日)';
  const time = '(\\d{1,2})(?:時(?:(半)|(\\d{1,2})分)?|:(\\d{2}))';
  const suffix = new RegExp(`^(?:${date})\\s*(?:${time})\\s*投稿(?:\\s*#?(\\d+))?$`);
  const prefix = new RegExp(`^投稿(?:\\s*#?(\\d+))?\\s+(?:${date})\\s*(?:${time})$`);
  const suffixMatch = normalized.match(suffix);
  const prefixMatch = normalized.match(prefix);
  if (!suffixMatch && !prefixMatch) return undefined;

  let explicitMonth: number | undefined;
  let explicitDay: number | undefined;
  let relative: string | undefined;
  let hour: number;
  let minute: number;
  let postNumber: number | undefined;

  if (suffixMatch) {
    explicitMonth = suffixMatch[1] ? Number(suffixMatch[1]) : undefined;
    explicitDay = suffixMatch[2] ? Number(suffixMatch[2]) : undefined;
    relative = suffixMatch[3];
    hour = Number(suffixMatch[4]);
    minute = suffixMatch[5] ? 30 : Number(suffixMatch[6] || suffixMatch[7] || 0);
    postNumber = suffixMatch[8] ? Number(suffixMatch[8]) : undefined;
  } else {
    postNumber = prefixMatch?.[1] ? Number(prefixMatch[1]) : undefined;
    explicitMonth = prefixMatch?.[2] ? Number(prefixMatch[2]) : undefined;
    explicitDay = prefixMatch?.[3] ? Number(prefixMatch[3]) : undefined;
    relative = prefixMatch?.[4];
    hour = Number(prefixMatch?.[5]);
    minute = prefixMatch?.[6] ? 30 : Number(prefixMatch?.[7] || prefixMatch?.[8] || 0);
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || (postNumber !== undefined && postNumber < 1)) {
    return undefined;
  }

  const current = jstParts(now);
  let year = current.year;
  let month = explicitMonth || current.month;
  let day = explicitDay || current.day;
  if (relative) {
    const shifted = addCalendarDays(current.year, current.month, current.day, relative === '明日' ? 1 : 0);
    year = shifted.year;
    month = shifted.month;
    day = shifted.day;
  } else if (explicitMonth) {
    const candidate = toJstDate(year, month, day, hour, minute);
    if (candidate && candidate.getTime() <= now.getTime()) year += 1;
  } else {
    let candidate = toJstDate(year, month, day, hour, minute);
    if (candidate && candidate.getTime() <= now.getTime()) {
      const advanced = nextMonth(year, month);
      year = advanced.year;
      month = advanced.month;
      candidate = toJstDate(year, month, day, hour, minute);
    }
  }

  const scheduled = toJstDate(year, month, day, hour, minute);
  if (!scheduled || scheduled.getTime() <= now.getTime()) return undefined;
  return { scheduledTimeIso: scheduled.toISOString(), postNumber };
}

export function formatScheduledAtJst(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatDateTimePickerValue(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = jstParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

export async function findThreadsLineBinding(groupId: string, lineMessageId: string, cardIndex?: number) {
  await ensureTable(BINDINGS_TABLE, BINDINGS_SCHEMA);
  const conditions = ['group_id = @groupId', 'line_message_id = @lineMessageId'];
  const params: Record<string, unknown> = { groupId, lineMessageId };
  if (cardIndex !== undefined) {
    conditions.push('card_index = @cardIndex');
    params.cardIndex = cardIndex;
  }
  const [rows] = await client.query({
    query: `
      SELECT schedule_id, analyca_user_id, card_index, card_count
      FROM \`${projectId}.${DATASET}.${BINDINGS_TABLE}\`
      WHERE ${conditions.join(' AND ')}
      ORDER BY card_index
    `,
    params,
  });
  return rows.map((row) => ({
    scheduleId: plain((row as Record<string, unknown>).schedule_id),
    analycaUserId: plain((row as Record<string, unknown>).analyca_user_id),
    cardIndex: Number((row as Record<string, unknown>).card_index),
    cardCount: Number((row as Record<string, unknown>).card_count),
  }));
}

export async function listRecentDraftPosts(userId: string) {
  const [rows] = await client.query({
    query: `
      SELECT schedule_id
      FROM \`${projectId}.${DATASET}.scheduled_posts\`
      WHERE user_id = @userId
        AND status = 'draft'
        AND created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 14 DAY)
      ORDER BY created_at DESC
      LIMIT 12
    `,
    params: { userId },
  });
  const posts = await Promise.all(rows.map((row) => getScheduledPostById(plain((row as Record<string, unknown>).schedule_id))));
  return posts.filter((post): post is ScheduledPostRow => Boolean(post));
}

export async function listUpcomingScheduledPosts(userId: string) {
  const [rows] = await client.query({
    query: `
      SELECT schedule_id
      FROM \`${projectId}.${DATASET}.scheduled_posts\`
      WHERE user_id = @userId
        AND status = 'scheduled'
        AND scheduled_time > CURRENT_TIMESTAMP()
      ORDER BY scheduled_time
      LIMIT 10
    `,
    params: { userId },
  });
  const posts = await Promise.all(rows.map((row) => getScheduledPostById(plain((row as Record<string, unknown>).schedule_id))));
  return posts.filter((post): post is ScheduledPostRow => Boolean(post));
}

async function findCollision(userId: string, scheduleId: string, scheduledTimeIso: string) {
  const [rows] = await client.query({
    query: `
      SELECT schedule_id, scheduled_time
      FROM \`${projectId}.${DATASET}.scheduled_posts\`
      WHERE user_id = @userId
        AND schedule_id != @scheduleId
        AND status IN ('scheduled', 'processing', 'partial')
        AND ABS(TIMESTAMP_DIFF(scheduled_time, @scheduledTime, MINUTE)) < @windowMinutes
      ORDER BY scheduled_time
      LIMIT 1
    `,
    params: {
      userId,
      scheduleId,
      scheduledTime: new Date(scheduledTimeIso),
      windowMinutes: COLLISION_WINDOW_MINUTES,
    },
    types: { scheduledTime: 'TIMESTAMP', windowMinutes: 'INT64' },
  });
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return {
    scheduleId: plain(row.schedule_id),
    scheduledTime: plain(row.scheduled_time),
  };
}

export async function scheduleDraftAt(
  scheduleId: string,
  userId: string,
  scheduledTimeIso: string,
): Promise<ThreadsScheduleMutationResult> {
  if (new Date(scheduledTimeIso).getTime() <= Date.now()) {
    return { ok: false, message: '過去の日時は指定できません。' };
  }
  const collision = await findCollision(userId, scheduleId, scheduledTimeIso);
  if (collision) {
    return {
      ok: false,
      message: `${formatScheduledAtJst(collision.scheduledTime)}に別の投稿があります。15分以上空けて指定してください。`,
    };
  }
  await client.query({
    query: `
      UPDATE \`${projectId}.${DATASET}.scheduled_posts\`
      SET scheduled_time = @scheduledTime,
          status = 'scheduled',
          updated_at = CURRENT_TIMESTAMP(),
          error_message = NULL
      WHERE schedule_id = @scheduleId
        AND user_id = @userId
        AND status = 'draft'
    `,
    params: { scheduleId, userId, scheduledTime: new Date(scheduledTimeIso) },
    types: { scheduledTime: 'TIMESTAMP' },
  });
  const post = await getScheduledPostById(scheduleId);
  if (!post || post.status !== 'scheduled' || new Date(post.scheduled_time).getTime() !== new Date(scheduledTimeIso).getTime()) {
    return { ok: false, message: '予約処理に失敗しました。投稿の状態を確認してください。' };
  }
  return { ok: true, message: `${formatScheduledAtJst(post.scheduled_time)}で予約しました。`, post };
}

export async function changeScheduledPostAt(
  scheduleId: string,
  userId: string,
  scheduledTimeIso: string,
): Promise<ThreadsScheduleMutationResult> {
  if (new Date(scheduledTimeIso).getTime() <= Date.now()) {
    return { ok: false, message: '過去の日時は指定できません。' };
  }
  const collision = await findCollision(userId, scheduleId, scheduledTimeIso);
  if (collision) {
    return {
      ok: false,
      message: `${formatScheduledAtJst(collision.scheduledTime)}に別の投稿があります。15分以上空けて指定してください。`,
    };
  }
  await client.query({
    query: `
      UPDATE \`${projectId}.${DATASET}.scheduled_posts\`
      SET scheduled_time = @scheduledTime,
          updated_at = CURRENT_TIMESTAMP(),
          error_message = NULL
      WHERE schedule_id = @scheduleId
        AND user_id = @userId
        AND status = 'scheduled'
        AND scheduled_time > CURRENT_TIMESTAMP()
    `,
    params: { scheduleId, userId, scheduledTime: new Date(scheduledTimeIso) },
    types: { scheduledTime: 'TIMESTAMP' },
  });
  const post = await getScheduledPostById(scheduleId);
  if (!post || post.status !== 'scheduled' || new Date(post.scheduled_time).getTime() !== new Date(scheduledTimeIso).getTime()) {
    return { ok: false, message: '予約変更に失敗しました。投稿の状態を確認してください。' };
  }
  return { ok: true, message: `${formatScheduledAtJst(post.scheduled_time)}へ予約を変更しました。`, post };
}
