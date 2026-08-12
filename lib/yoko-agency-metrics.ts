import { BigQuery } from '@google-cloud/bigquery';

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID || 'mark-454114';
const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS || '{}';
const ANALYCA_DATASET = 'analyca';
const LSTEP_DATASET = 'analyca_yoko_lstep';
const YOKO_TAG_NAME = 'Threads';
const BOT_USER_AGENT_PATTERN = 'curl|notebot|bot|crawler|spider|preview';

export const YOKO_ANALYCA_USER_ID = '33833959932919231';
export const YOKO_THREADS_USERNAME = 'yoko_gemqueen';

export interface YokoAgencyDailyMetric {
  date: string;
  linkClicks: number;
  lineRegistrations: number;
}

export interface YokoAgencyMetrics {
  linkClicks: number;
  lineRegistrations: number;
  previousLineRegistrations: number;
  latestSnapshotDate: string | null;
  daily: YokoAgencyDailyMetric[];
}

interface ClickRow {
  date: unknown;
  link_clicks: unknown;
  line_registrations?: unknown;
}

interface RegistrationSnapshotRow {
  snapshot_date: unknown;
  registrations: unknown;
}

function parseCredentials(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

const credentials = parseCredentials(credentialsJson);
const bigquery = new BigQuery({
  projectId,
  ...(typeof credentials.client_email === 'string' ? { credentials } : {}),
});

function toNumber(value: unknown): number {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'value' in value) {
    return Number((value as { value: unknown }).value) || 0;
  }
  return Number(value) || 0;
}

function toDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value && typeof value === 'object' && 'value' in value) {
    return String((value as { value: unknown }).value).slice(0, 10);
  }
  return String(value ?? '').slice(0, 10);
}

export function summarizeYokoMetrics(
  clickRows: ClickRow[],
  registrationRows: RegistrationSnapshotRow[],
): YokoAgencyMetrics {
  const registrations = registrationRows
    .map((row) => ({
      date: toDateString(row.snapshot_date),
      registrations: toNumber(row.registrations),
    }))
    .filter((row) => row.date)
    .sort((a, b) => b.date.localeCompare(a.date));
  const registrationByDate = new Map(registrations.map((row) => [row.date, row.registrations]));
  const dailyMap = new Map<string, YokoAgencyDailyMetric>();

  for (const row of clickRows) {
    const date = toDateString(row.date);
    if (!date) continue;
    dailyMap.set(date, {
      date,
      linkClicks: toNumber(row.link_clicks),
      lineRegistrations: registrationByDate.get(date) ?? toNumber(row.line_registrations),
    });
  }
  for (const row of registrations) {
    const existing = dailyMap.get(row.date);
    dailyMap.set(row.date, {
      date: row.date,
      linkClicks: existing?.linkClicks ?? 0,
      lineRegistrations: row.registrations,
    });
  }

  const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  return {
    linkClicks: daily.reduce((sum, row) => sum + row.linkClicks, 0),
    lineRegistrations: registrations[0]?.registrations ?? 0,
    previousLineRegistrations: registrations[1]?.registrations ?? registrations[0]?.registrations ?? 0,
    latestSnapshotDate: registrations[0]?.date ?? null,
    daily,
  };
}

export async function getYokoAgencyMetrics(): Promise<YokoAgencyMetrics> {
  const [clickResult, registrationResult] = await Promise.all([
    bigquery.query({
      query: `
        SELECT
          DATE(clicked_at, "Asia/Tokyo") AS date,
          COUNT(*) AS link_clicks
        FROM \`${projectId}.${ANALYCA_DATASET}.option_click_logs\`
        WHERE user_id = @userId
          AND clicked_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)
          AND NOT REGEXP_CONTAINS(LOWER(COALESCE(user_agent, "")), @botPattern)
        GROUP BY date
        ORDER BY date
      `,
      params: {
        userId: YOKO_ANALYCA_USER_ID,
        botPattern: BOT_USER_AGENT_PATTERN,
      },
    }),
    bigquery.query({
      query: `
        SELECT
          snapshot_date,
          COUNT(DISTINCT IF(tag_flag = 1, user_id, NULL)) AS registrations
        FROM \`${projectId}.${LSTEP_DATASET}.user_tags\`
        WHERE tag_name = @tagName
          AND snapshot_date >= DATE_SUB(CURRENT_DATE("Asia/Tokyo"), INTERVAL 365 DAY)
        GROUP BY snapshot_date
        ORDER BY snapshot_date DESC
      `,
      params: { tagName: YOKO_TAG_NAME },
    }),
  ]);

  return summarizeYokoMetrics(
    clickResult[0] as ClickRow[],
    registrationResult[0] as RegistrationSnapshotRow[],
  );
}
