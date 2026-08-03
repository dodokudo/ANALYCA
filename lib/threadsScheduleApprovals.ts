import { createHash } from 'node:crypto';
import { BigQuery } from '@google-cloud/bigquery';
import { getScheduledPostById, scheduleDraftPost } from '@/lib/bigqueryScheduledPosts';

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
const TABLE = 'threads_schedule_approvals';

const SCHEMA = [
  { name: 'token_hash', type: 'STRING', mode: 'REQUIRED' },
  { name: 'schedule_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'group_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'status', type: 'STRING', mode: 'REQUIRED' },
  { name: 'expires_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
  { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
  { name: 'used_at', type: 'TIMESTAMP' },
];

type ApprovalRow = {
  token_hash: string;
  schedule_id: string;
  user_id: string;
  group_id: string;
  status: string;
  expires_at: { value?: string } | string;
};

export type ScheduleApprovalResult = {
  ok: boolean;
  alreadyScheduled?: boolean;
  message: string;
  scheduleId?: string;
  scheduledAtJst?: string;
};

async function ensureTable() {
  const table = client.dataset(DATASET).table(TABLE);
  const [exists] = await table.exists();
  if (exists) return;
  try {
    await client.dataset(DATASET).createTable(TABLE, { schema: SCHEMA });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('Already Exists')) throw error;
  }
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function toIsoString(value: ApprovalRow['expires_at']) {
  if (typeof value === 'string') return value;
  return value?.value || '';
}

function formatScheduledAtJst(value: string) {
  const date = new Date(value);
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

export async function confirmThreadsScheduleApproval(token: string, groupId: string): Promise<ScheduleApprovalResult> {
  await ensureTable();
  const tokenHash = hashToken(token);
  const [rows] = await client.query({
    query: `
      SELECT token_hash, schedule_id, user_id, group_id, status, expires_at
      FROM \`${projectId}.${DATASET}.${TABLE}\`
      WHERE token_hash = @tokenHash AND group_id = @groupId
      LIMIT 1
    `,
    params: { tokenHash, groupId },
  });
  const approval = rows[0] as ApprovalRow | undefined;
  if (!approval) {
    return { ok: false, message: 'この予約ボタンは無効です。最新の投稿確認メッセージを使用してください。' };
  }

  const expiresAt = new Date(toIsoString(approval.expires_at));
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return { ok: false, message: 'この予約ボタンの有効期限が切れています。最新の投稿確認メッセージを使用してください。' };
  }

  const current = await getScheduledPostById(approval.schedule_id);
  if (!current || current.user_id !== approval.user_id) {
    return { ok: false, message: '対象の下書きが見つかりませんでした。' };
  }

  const scheduledAtJst = formatScheduledAtJst(current.scheduled_time);
  if (current.status === 'scheduled') {
    return {
      ok: true,
      alreadyScheduled: true,
      message: `${scheduledAtJst}で予約済みです。`,
      scheduleId: current.schedule_id,
      scheduledAtJst,
    };
  }
  if (approval.status === 'used') {
    return { ok: false, message: 'この予約ボタンはすでに使用されています。' };
  }
  if (current.status !== 'draft') {
    return { ok: false, message: `この投稿は予約できない状態です（${current.status}）。` };
  }
  if (new Date(current.scheduled_time).getTime() <= Date.now()) {
    return { ok: false, message: '予約日時が過ぎているため、予約できませんでした。' };
  }

  const updated = await scheduleDraftPost(current.schedule_id, current.user_id);
  if (!updated || updated.status !== 'scheduled') {
    return { ok: false, message: '予約処理に失敗しました。下書きの状態を確認してください。' };
  }

  await client.query({
    query: `
      UPDATE \`${projectId}.${DATASET}.${TABLE}\`
      SET status = 'used', used_at = CURRENT_TIMESTAMP()
      WHERE token_hash = @tokenHash AND group_id = @groupId
    `,
    params: { tokenHash, groupId },
  });

  return {
    ok: true,
    message: `${scheduledAtJst}で予約しました。`,
    scheduleId: updated.schedule_id,
    scheduledAtJst,
  };
}
