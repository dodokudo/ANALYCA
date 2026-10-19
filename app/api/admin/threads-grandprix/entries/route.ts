import { BigQuery } from '@google-cloud/bigquery';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { GRANDPRIX_EVENTS, DEFAULT_GRANDPRIX_EVENT_ID } from '@/lib/threads-grandprix-events';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '7684';
const ADMIN_USER_IDS = new Set([
  '27687413359912852',
  '27016191458061252',
]);

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID;
const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS;

let bigqueryClient: BigQuery | null = null;
let ensureTablePromise: Promise<void> | null = null;

function parseCredentials(json?: string): Record<string, unknown> | undefined {
  if (!json) return undefined;

  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch (error) {
    console.error('Failed to parse BigQuery credentials:', error);
    return undefined;
  }
}

function getBigQueryClient(): BigQuery {
  if (!bigqueryClient) {
    bigqueryClient = new BigQuery({
      projectId,
      credentials: parseCredentials(credentialsJson),
    });
  }

  return bigqueryClient;
}

async function executeDML(query: string): Promise<void> {
  const [job] = await getBigQueryClient().createQueryJob({ query });
  await job.getQueryResults();
}

async function ensureEntriesTable(): Promise<void> {
  if (!projectId) {
    throw new Error('PROJECT_ID is not configured.');
  }

  if (!ensureTablePromise) {
    ensureTablePromise = executeDML(`
      CREATE TABLE IF NOT EXISTS \`${projectId}.analyca.threads_grandprix_entries\` (
        id STRING NOT NULL,
        line_name STRING NOT NULL,
        threads_username STRING NOT NULL,
        normalized_threads_username STRING NOT NULL,
        has_analyca_at_entry BOOL,
        analyca_user_id_at_entry STRING,
        user_agent STRING,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL
      );
      ALTER TABLE \`${projectId}.analyca.threads_grandprix_entries\`
        ADD COLUMN IF NOT EXISTS has_analyca_at_entry BOOL;
      ALTER TABLE \`${projectId}.analyca.threads_grandprix_entries\`
        ADD COLUMN IF NOT EXISTS analyca_user_id_at_entry STRING;
      ALTER TABLE \`${projectId}.analyca.threads_grandprix_entries\`
        ADD COLUMN IF NOT EXISTS event_id STRING;
      ALTER TABLE \`${projectId}.analyca.threads_grandprix_entries\`
        ADD COLUMN IF NOT EXISTS original_threads_username STRING;
    `).catch((error) => {
      ensureTablePromise = null;
      throw error;
    });
  }

  return ensureTablePromise;
}

async function isAdminByCookie(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('analycaUserId')?.value;
    return !!userId && ADMIN_USER_IDS.has(userId);
  } catch {
    return false;
  }
}

function isAdminByPassword(password: string | null): boolean {
  return password === ADMIN_PASSWORD;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const password = url.searchParams.get('password') || request.headers.get('x-admin-password');

    if (!isAdminByPassword(password) && !(await isAdminByCookie())) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 },
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'PROJECT_ID is not configured.' },
        { status: 500 },
      );
    }

    const searchUser = url.searchParams.get('searchUser');
    if (searchUser !== null) {
      const search = searchUser.trim().replace(/^@/, '').toLowerCase();
      if (search.length < 2) return NextResponse.json({ success: true, users: [] });
      const [users] = await getBigQueryClient().query({
        query: `SELECT user_id, threads_username FROM \`${projectId}.analyca.users\`
          WHERE NULLIF(TRIM(threads_username), '') IS NOT NULL
            AND (STRPOS(LOWER(threads_username), @search) > 0 OR user_id = @search)
          ORDER BY IF(LOWER(threads_username) = @search, 0, 1), threads_username
          LIMIT 20`,
        params: { search },
      });
      return NextResponse.json({ success: true, users });
    }

    const events = GRANDPRIX_EVENTS;
    const eventId = url.searchParams.get('event') || DEFAULT_GRANDPRIX_EVENT_ID;
    const event = events.find((candidate) => candidate.eventId === eventId);
    if (!event) return NextResponse.json({ success: false, error: '大会が見つかりません' }, { status: 404 });

    await ensureEntriesTable();

    const [rows] = await getBigQueryClient().query({
      query: `
        WITH users AS (
          SELECT *, LOWER(REGEXP_REPLACE(TRIM(threads_username), r'^@', '')) AS normalized_username
          FROM \`${projectId}.analyca.users\`
          WHERE threads_username IS NOT NULL
          QUALIFY ROW_NUMBER() OVER (
            PARTITION BY LOWER(REGEXP_REPLACE(TRIM(threads_username), r'^@', ''))
            ORDER BY threads_token_expires_at DESC, created_at ASC
          ) = 1
        ), metrics AS (
          SELECT user_id, MAX(updated_at) AS last_data_at
          FROM \`${projectId}.analyca.threads_daily_metrics\`
          GROUP BY user_id
        )
        SELECT
          e.id, e.line_name, e.threads_username, e.original_threads_username, e.event_id,
          e.has_analyca_at_entry, e.analyca_user_id_at_entry,
          e.created_at, e.updated_at,
          u.user_id AS current_user_id, m.last_data_at,
          CASE
            WHEN u.user_id IS NULL OR NOT COALESCE(u.has_threads, FALSE) THEN 'not_connected'
            WHEN NULLIF(u.threads_access_token, '') IS NULL OR u.threads_token_expires_at IS NULL
              OR u.threads_token_expires_at <= CURRENT_TIMESTAMP() THEN 'reconnect_required'
            WHEN m.last_data_at IS NULL OR m.last_data_at < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 48 HOUR)
              THEN 'needs_check'
            ELSE 'connected'
          END AS connection_status
        FROM \`${projectId}.analyca.threads_grandprix_entries\` e
        LEFT JOIN users u ON u.normalized_username = e.normalized_threads_username
        LEFT JOIN metrics m ON m.user_id = u.user_id
        WHERE e.event_id = @eventId
        ORDER BY e.updated_at DESC
        LIMIT 500
      `,
      params: { eventId },
    });

    return NextResponse.json({
      success: true,
      data: {
        event,
        events,
        entries: rows.map((row) => ({
          id: row.id,
          originalThreadsUsername: row.original_threads_username || null,
          eventId: row.event_id,
          currentUserId: row.current_user_id || null,
          connectionStatus: row.connection_status,
          lastDataAt: row.last_data_at?.value || row.last_data_at || null,
          lineName: row.line_name,
          threadsUsername: row.threads_username,
          hasAnalycaAtEntry: row.has_analyca_at_entry === true,
          analycaUserIdAtEntry: row.analyca_user_id_at_entry || null,
          createdAt: row.created_at?.value || row.created_at,
          updatedAt: row.updated_at?.value || row.updated_at,
        })),
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Threads Grandprix admin entries error:', error);
    return NextResponse.json(
      { success: false, error: 'エントリー一覧の取得に失敗しました' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  if (!isAdminByPassword(request.headers.get('x-admin-password')) && !(await isAdminByCookie())) {
    return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });
  }
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: '入力内容を確認してください' }, { status: 400 });
  }
  const { entryId, eventId, userId, expectedUsername } = body || {};
  if (![entryId, eventId, userId, expectedUsername].every(value => typeof value === 'string' && value.trim())) {
    return NextResponse.json({ success: false, error: 'エントリーと会員を選択してください' }, { status: 400 });
  }
  if (!GRANDPRIX_EVENTS.some(event => event.eventId === eventId)) {
    return NextResponse.json({ success: false, error: '大会が見つかりません' }, { status: 404 });
  }
  try {
    await ensureEntriesTable();
    // 同じ大会の重複紐づけと、古い画面からの上書きをトランザクション内で拒否する。
    // 既存の参加資格・集計も参照する正規化IDを、選択した会員のIDに合わせる。
    const [job] = await getBigQueryClient().createQueryJob({
      query: `
        DECLARE selected_username STRING;
        DECLARE normalized_username STRING;
        BEGIN TRANSACTION;
        ASSERT (SELECT COUNT(*) FROM \`${projectId}.analyca.threads_grandprix_entries\`
          WHERE id = @entryId AND event_id = @eventId AND threads_username = @expectedUsername) = 1
          AS 'ENTRY_CHANGED';
        ASSERT (SELECT COUNT(*) FROM \`${projectId}.analyca.users\`
          WHERE user_id = @userId AND NULLIF(TRIM(threads_username), '') IS NOT NULL) = 1
          AS 'USER_NOT_FOUND';
        SET selected_username = (SELECT threads_username FROM \`${projectId}.analyca.users\` WHERE user_id = @userId);
        SET normalized_username = LOWER(REGEXP_REPLACE(TRIM(selected_username), r'^@', ''));
        ASSERT (SELECT COUNT(*) FROM \`${projectId}.analyca.users\`
          WHERE LOWER(REGEXP_REPLACE(TRIM(threads_username), r'^@', '')) = normalized_username) = 1
          AS 'AMBIGUOUS_USER';
        ASSERT NOT EXISTS (SELECT 1 FROM \`${projectId}.analyca.threads_grandprix_entries\`
          WHERE event_id = @eventId AND id != @entryId AND normalized_threads_username = normalized_username)
          AS 'ALREADY_LINKED';
        UPDATE \`${projectId}.analyca.threads_grandprix_entries\`
          SET original_threads_username = COALESCE(original_threads_username, threads_username),
              threads_username = selected_username, normalized_threads_username = normalized_username,
              updated_at = CURRENT_TIMESTAMP()
          WHERE id = @entryId AND event_id = @eventId;
        COMMIT TRANSACTION;
        SELECT id, event_id, threads_username, original_threads_username
          FROM \`${projectId}.analyca.threads_grandprix_entries\` WHERE id = @entryId AND event_id = @eventId;
      `,
      params: { entryId, eventId, userId, expectedUsername },
    });
    const [rows] = await job.getQueryResults();
    return NextResponse.json({ success: true, entry: rows[0] });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const conflicts: Record<string, string> = {
      ENTRY_CHANGED: 'エントリーが変更されています。一覧を更新してください。',
      USER_NOT_FOUND: '会員が見つかりません。検索し直してください。',
      AMBIGUOUS_USER: '同じThreads IDの会員が複数あります。会員情報を確認してください。',
      ALREADY_LINKED: 'この会員は同じ大会の別エントリーに紐づいています。',
    };
    for (const [code, text] of Object.entries(conflicts)) {
      if (message.includes(code)) return NextResponse.json({ success: false, error: text }, { status: 409 });
    }
    console.error('Grandprix entry linking failed:', error);
    return NextResponse.json({ success: false, error: '紐づけを保存できませんでした。もう一度お試しください。' }, { status: 500 });
  }
}
