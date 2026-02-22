import { BigQuery } from '@google-cloud/bigquery';

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
const TABLE = 'scheduled_posts';

const SCHEMA = [
  { name: 'schedule_id', type: 'STRING' },
  { name: 'user_id', type: 'STRING' },
  { name: 'scheduled_time', type: 'TIMESTAMP' },
  { name: 'status', type: 'STRING' },
  { name: 'main_text', type: 'STRING' },
  { name: 'comment1', type: 'STRING' },
  { name: 'comment2', type: 'STRING' },
  { name: 'created_at', type: 'TIMESTAMP' },
  { name: 'updated_at', type: 'TIMESTAMP' },
  { name: 'main_thread_id', type: 'STRING' },
  { name: 'comment1_thread_id', type: 'STRING' },
  { name: 'comment2_thread_id', type: 'STRING' },
];

async function query<T = Record<string, unknown>>(sql: string, params?: Record<string, unknown>, types?: Record<string, string>) {
  const [rows] = await client.query({ query: sql, params, types });
  return rows as T[];
}

async function ensureTable() {
  const dataset = client.dataset(DATASET);
  const table = dataset.table(TABLE);
  const [exists] = await table.exists();
  if (!exists) {
    try {
      await dataset.createTable(TABLE, { schema: SCHEMA });
    } catch (error) {
      const message = (error as Error)?.message || '';
      if (!message.includes('Already Exists')) throw error;
    }
  }
}

function toPlain(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
    const inner = (value as Record<string, unknown>).value;
    return typeof inner === 'string' ? inner : String(inner ?? '');
  }
  return String(value);
}

export type ScheduledPostRow = {
  schedule_id: string;
  user_id: string;
  scheduled_time: string;
  scheduled_at_jst: string;
  scheduled_date: string;
  status: string;
  main_text: string;
  comment1: string;
  comment2: string;
  created_at: string;
  updated_at: string;
  main_thread_id?: string | null;
  comment1_thread_id?: string | null;
  comment2_thread_id?: string | null;
};

function mapRow(row: Record<string, unknown>): ScheduledPostRow {
  return {
    schedule_id: toPlain(row.schedule_id),
    user_id: toPlain(row.user_id),
    scheduled_time: toPlain(row.scheduled_time),
    scheduled_at_jst: toPlain(row.scheduled_at_jst),
    scheduled_date: toPlain(row.scheduled_date),
    status: toPlain(row.status) || 'scheduled',
    main_text: toPlain(row.main_text),
    comment1: toPlain(row.comment1),
    comment2: toPlain(row.comment2),
    created_at: toPlain(row.created_at),
    updated_at: toPlain(row.updated_at),
    main_thread_id: toPlain(row.main_thread_id) || null,
    comment1_thread_id: toPlain(row.comment1_thread_id) || null,
    comment2_thread_id: toPlain(row.comment2_thread_id) || null,
  };
}

export async function listScheduledPosts(userId: string, params: { startDate?: string; endDate?: string }) {
  await ensureTable();
  const conditions: string[] = ['sp.user_id = @userId'];
  const queryParams: Record<string, unknown> = { userId };

  if (params.startDate) {
    conditions.push('DATE(sp.scheduled_time, "Asia/Tokyo") >= DATE(@startDate)');
    queryParams.startDate = params.startDate;
  }
  if (params.endDate) {
    conditions.push('DATE(sp.scheduled_time, "Asia/Tokyo") <= DATE(@endDate)');
    queryParams.endDate = params.endDate;
  }

  const sql = `
    SELECT
      sp.schedule_id, sp.user_id, sp.scheduled_time, sp.status,
      sp.main_text, sp.comment1, sp.comment2,
      sp.created_at, sp.updated_at,
      sp.main_thread_id, sp.comment1_thread_id, sp.comment2_thread_id,
      FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%S+09:00', sp.scheduled_time, 'Asia/Tokyo') AS scheduled_at_jst,
      FORMAT_DATE('%Y-%m-%d', DATE(sp.scheduled_time, 'Asia/Tokyo')) AS scheduled_date
    FROM \`${projectId}.${DATASET}.${TABLE}\` sp
    WHERE ${conditions.join(' AND ')}
    ORDER BY sp.scheduled_time ASC
  `;

  const rows = await query(sql, queryParams);
  return rows.map(mapRow);
}

export async function listAllPendingPosts(params: { startDate?: string; endDate?: string }) {
  await ensureTable();
  const conditions: string[] = ["sp.status = 'scheduled'"];
  const queryParams: Record<string, unknown> = {};

  if (params.startDate) {
    conditions.push('DATE(sp.scheduled_time, "Asia/Tokyo") >= DATE(@startDate)');
    queryParams.startDate = params.startDate;
  }
  if (params.endDate) {
    conditions.push('DATE(sp.scheduled_time, "Asia/Tokyo") <= DATE(@endDate)');
    queryParams.endDate = params.endDate;
  }

  const sql = `
    SELECT
      sp.schedule_id, sp.user_id, sp.scheduled_time, sp.status,
      sp.main_text, sp.comment1, sp.comment2,
      sp.created_at, sp.updated_at,
      sp.main_thread_id, sp.comment1_thread_id, sp.comment2_thread_id,
      FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%S+09:00', sp.scheduled_time, 'Asia/Tokyo') AS scheduled_at_jst,
      FORMAT_DATE('%Y-%m-%d', DATE(sp.scheduled_time, 'Asia/Tokyo')) AS scheduled_date
    FROM \`${projectId}.${DATASET}.${TABLE}\` sp
    WHERE ${conditions.join(' AND ')}
    ORDER BY sp.scheduled_time ASC
  `;

  const rows = await query(sql, queryParams);
  return rows.map(mapRow);
}

export async function getScheduledPostById(scheduleId: string) {
  await ensureTable();
  const sql = `
    SELECT
      sp.schedule_id, sp.user_id, sp.scheduled_time, sp.status,
      sp.main_text, sp.comment1, sp.comment2,
      sp.created_at, sp.updated_at,
      sp.main_thread_id, sp.comment1_thread_id, sp.comment2_thread_id,
      FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%S+09:00', sp.scheduled_time, 'Asia/Tokyo') AS scheduled_at_jst,
      FORMAT_DATE('%Y-%m-%d', DATE(sp.scheduled_time, 'Asia/Tokyo')) AS scheduled_date
    FROM \`${projectId}.${DATASET}.${TABLE}\` sp
    WHERE sp.schedule_id = @scheduleId
    LIMIT 1
  `;
  const rows = await query(sql, { scheduleId });
  return rows[0] ? mapRow(rows[0]) : undefined;
}

export async function insertScheduledPost(params: {
  scheduleId: string;
  userId: string;
  scheduledTimeIso: string;
  status: string;
  mainText: string;
  comment1: string;
  comment2: string;
}) {
  await ensureTable();
  const sql = `
    INSERT INTO \`${projectId}.${DATASET}.${TABLE}\`
    (schedule_id, user_id, scheduled_time, status, main_text, comment1, comment2, created_at, updated_at)
    VALUES (@scheduleId, @userId, @scheduledTime, @status, @mainText, @comment1, @comment2, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
  `;
  await client.query({
    query: sql,
    params: {
      scheduleId: params.scheduleId,
      userId: params.userId,
      scheduledTime: new Date(params.scheduledTimeIso),
      status: params.status,
      mainText: params.mainText,
      comment1: params.comment1,
      comment2: params.comment2,
    },
  });
  return getScheduledPostById(params.scheduleId);
}

export async function updateScheduledPost(
  scheduleId: string,
  params: {
    scheduledTimeIso?: string | null;
    status?: string | null;
    mainText?: string | null;
    comment1?: string | null;
    comment2?: string | null;
    mainThreadId?: string | null;
    comment1ThreadId?: string | null;
    comment2ThreadId?: string | null;
  },
) {
  await ensureTable();
  const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP()'];
  const queryParams: Record<string, unknown> = { scheduleId };
  const types: Record<string, string> = {};

  if (params.scheduledTimeIso !== undefined && params.scheduledTimeIso !== null) {
    setClauses.push('scheduled_time = @scheduledTime');
    queryParams.scheduledTime = new Date(params.scheduledTimeIso);
    types.scheduledTime = 'TIMESTAMP';
  }
  if (params.status !== undefined) {
    setClauses.push('status = @status');
    queryParams.status = params.status;
    types.status = 'STRING';
  }
  if (params.mainText !== undefined) {
    setClauses.push('main_text = @mainText');
    queryParams.mainText = params.mainText;
    types.mainText = 'STRING';
  }
  if (params.comment1 !== undefined) {
    setClauses.push('comment1 = @comment1');
    queryParams.comment1 = params.comment1;
    types.comment1 = 'STRING';
  }
  if (params.comment2 !== undefined) {
    setClauses.push('comment2 = @comment2');
    queryParams.comment2 = params.comment2;
    types.comment2 = 'STRING';
  }
  if (params.mainThreadId !== undefined) {
    setClauses.push('main_thread_id = @mainThreadId');
    queryParams.mainThreadId = params.mainThreadId;
    types.mainThreadId = 'STRING';
  }
  if (params.comment1ThreadId !== undefined) {
    setClauses.push('comment1_thread_id = @comment1ThreadId');
    queryParams.comment1ThreadId = params.comment1ThreadId;
    types.comment1ThreadId = 'STRING';
  }
  if (params.comment2ThreadId !== undefined) {
    setClauses.push('comment2_thread_id = @comment2ThreadId');
    queryParams.comment2ThreadId = params.comment2ThreadId;
    types.comment2ThreadId = 'STRING';
  }

  const sql = `
    UPDATE \`${projectId}.${DATASET}.${TABLE}\`
    SET ${setClauses.join(', ')}
    WHERE schedule_id = @scheduleId
  `;
  await client.query({ query: sql, params: queryParams, types: Object.keys(types).length > 0 ? types : undefined });
  return getScheduledPostById(scheduleId);
}

export async function claimScheduledPost(scheduleId: string): Promise<boolean> {
  await ensureTable();
  const sql = `
    UPDATE \`${projectId}.${DATASET}.${TABLE}\`
    SET status = 'processing', updated_at = CURRENT_TIMESTAMP()
    WHERE schedule_id = @scheduleId AND status = 'scheduled'
  `;
  const [job] = await client.createQueryJob({ query: sql, params: { scheduleId } });
  await job.getQueryResults();
  const [metadata] = await job.getMetadata();
  const affected = parseInt(metadata.statistics?.query?.numDmlAffectedRows || '0', 10);
  return affected > 0;
}

export async function deleteScheduledPost(scheduleId: string) {
  await ensureTable();
  const sql = `
    DELETE FROM \`${projectId}.${DATASET}.${TABLE}\`
    WHERE schedule_id = @scheduleId
  `;
  await client.query({ query: sql, params: { scheduleId } });
}

export function toJstIsoString(dateTime: string) {
  if (!dateTime) return '';
  const trimmed = dateTime.trim();
  const timezoneMatch = trimmed.match(/([+-]\d{2}:\d{2}|Z)$/);
  if (timezoneMatch) {
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString();
  }
  const normalized = trimmed.replace(' ', 'T');
  const withSeconds = normalized.length === 16 ? `${normalized}:00` : normalized;
  const parsed = new Date(`${withSeconds}+09:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString();
}
