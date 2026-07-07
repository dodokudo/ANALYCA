import { BigQuery } from '@google-cloud/bigquery';
import { NextRequest, NextResponse } from 'next/server';

type EntryBody = {
  lineName?: unknown;
  threadsUsername?: unknown;
};

let bigqueryClient: BigQuery | null = null;
let ensureTablePromise: Promise<void> | null = null;

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID;
const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS;

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

async function executeDML(query: string, params?: Record<string, unknown>): Promise<void> {
  const [job] = await getBigQueryClient().createQueryJob({ query, params });
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
    `).catch((error) => {
      ensureTablePromise = null;
      throw error;
    });
  }

  return ensureTablePromise;
}

function normalizeThreadsUsername(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase();
}

function isValidThreadsUsername(value: string): boolean {
  return /^[a-z0-9._]{2,30}$/.test(value);
}

async function findAnalycaUserByThreadsUsername(normalizedThreadsUsername: string): Promise<{
  hasAnalyca: boolean;
  userId: string | null;
}> {
  const [rows] = await getBigQueryClient().query({
    query: `
      SELECT user_id
      FROM \`${projectId}.analyca.users\`
      WHERE threads_username IS NOT NULL
        AND LOWER(REGEXP_REPLACE(TRIM(threads_username), r'^@', '')) = @normalizedThreadsUsername
      ORDER BY created_at ASC
      LIMIT 1
    `,
    params: { normalizedThreadsUsername },
  });

  const userId = typeof rows[0]?.user_id === 'string' ? rows[0].user_id : null;
  return {
    hasAnalyca: !!userId,
    userId,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as EntryBody;
    const lineName = typeof body.lineName === 'string' ? body.lineName.trim() : '';
    const rawThreadsUsername = typeof body.threadsUsername === 'string' ? body.threadsUsername.trim() : '';
    const normalizedThreadsUsername = normalizeThreadsUsername(rawThreadsUsername);

    if (!lineName || !normalizedThreadsUsername) {
      return NextResponse.json(
        { success: false, error: 'LINEの登録名とThreadsのユーザーIDを入力してください。' },
        { status: 400 },
      );
    }

    if (lineName.length > 80) {
      return NextResponse.json(
        { success: false, error: 'LINEの登録名は80文字以内で入力してください。' },
        { status: 400 },
      );
    }

    if (!isValidThreadsUsername(normalizedThreadsUsername)) {
      return NextResponse.json(
        { success: false, error: 'ThreadsのユーザーIDを正しい形式で入力してください。' },
        { status: 400 },
      );
    }

    await ensureEntriesTable();
    const analycaSnapshot = await findAnalycaUserByThreadsUsername(normalizedThreadsUsername);

    await executeDML(
      `
        MERGE \`${projectId}.analyca.threads_grandprix_entries\` target
        USING (
          SELECT
            @id AS id,
            @lineName AS line_name,
            @threadsUsername AS threads_username,
            @normalizedThreadsUsername AS normalized_threads_username,
            @hasAnalycaAtEntry AS has_analyca_at_entry,
            NULLIF(@analycaUserIdAtEntry, '') AS analyca_user_id_at_entry,
            @userAgent AS user_agent,
            CURRENT_TIMESTAMP() AS submitted_at
        ) source
        ON target.normalized_threads_username = source.normalized_threads_username
        WHEN MATCHED THEN
          UPDATE SET
            line_name = source.line_name,
            threads_username = source.threads_username,
            user_agent = source.user_agent,
            updated_at = source.submitted_at
        WHEN NOT MATCHED THEN
          INSERT (
            id,
            line_name,
            threads_username,
            normalized_threads_username,
            has_analyca_at_entry,
            analyca_user_id_at_entry,
            user_agent,
            created_at,
            updated_at
          )
          VALUES (
            source.id,
            source.line_name,
            source.threads_username,
            source.normalized_threads_username,
            source.has_analyca_at_entry,
            source.analyca_user_id_at_entry,
            source.user_agent,
            source.submitted_at,
            source.submitted_at
          )
      `,
      {
        id: crypto.randomUUID(),
        lineName,
        threadsUsername: normalizedThreadsUsername,
        normalizedThreadsUsername,
        hasAnalycaAtEntry: analycaSnapshot.hasAnalyca,
        analycaUserIdAtEntry: analycaSnapshot.userId || '',
        userAgent: request.headers.get('user-agent') || '',
      },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Threads Grandprix entry error:', error);
    return NextResponse.json(
      { success: false, error: '送信に失敗しました。時間をおいて再度お試しください。' },
      { status: 500 },
    );
  }
}
