import { BigQuery } from '@google-cloud/bigquery';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '7684';
const ADMIN_USER_IDS = new Set([
  '27687413359912852',
  '27016191458061252',
]);

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID;
const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS;

let bigqueryClient: BigQuery | null = null;

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

    const [rows] = await getBigQueryClient().query({
      query: `
        SELECT
          line_name,
          threads_username,
          created_at,
          updated_at
        FROM \`${projectId}.analyca.threads_grandprix_entries\`
        ORDER BY updated_at DESC
        LIMIT 500
      `,
    });

    return NextResponse.json({
      success: true,
      data: {
        entries: rows.map((row) => ({
          lineName: row.line_name,
          threadsUsername: row.threads_username,
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
