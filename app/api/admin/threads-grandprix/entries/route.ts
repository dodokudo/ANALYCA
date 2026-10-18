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
          e.line_name, e.threads_username, e.event_id,
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
