import { BigQuery } from '@google-cloud/bigquery';

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID || 'mark-454114';
const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS || '{}';
const ANALYCA_DATASET = 'analyca';
const LSTEP_DATASET = 'analyca_yoko_lstep';
export const YOKO_LINE_REGISTRATION_TAG_NAMES = [
  'Threads：固定',
  'Threads',
  'Threads：プロフィール',
  '【流入経路】Threads',
] as const;
export const YOKO_LINE_REGISTRATION_BASELINE_DATE = '2026-09-20';
// 2026-08-12以前は信頼できる日次スナップショットがないため、
// Lステップの流入経路一覧で確認できた登録日を補完する。
export const YOKO_LINE_REGISTRATION_BACKFILL_DATES = [
  '2026-08-05',
  '2026-08-11',
  '2026-08-16',
  '2026-08-17',
  '2026-08-19',
  '2026-08-22',
] as const;
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

interface DailyRegistrationRow {
  date: unknown;
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
  dailyRegistrationRows: DailyRegistrationRow[],
  registrationRows: RegistrationSnapshotRow[],
): YokoAgencyMetrics {
  const registrations = registrationRows
    .map((row) => ({
      date: toDateString(row.snapshot_date),
      registrations: toNumber(row.registrations),
    }))
    .filter((row) => row.date)
    .sort((a, b) => b.date.localeCompare(a.date));
  const dailyRegistrations = dailyRegistrationRows
    .map((row) => ({
      date: toDateString(row.date),
      registrations: toNumber(row.registrations),
    }))
    .filter((row) => row.date);
  const registrationByDate = new Map(
    dailyRegistrations.map((row) => [row.date, row.registrations]),
  );
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
  for (const row of dailyRegistrations) {
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
  const [clickResult, dailyRegistrationResult, registrationResult] = await Promise.all([
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
        WITH first_seen_users AS (
          SELECT
            user_id,
            MIN(snapshot_date) AS date
          FROM \`${projectId}.${LSTEP_DATASET}.user_core\`
          GROUP BY user_id
          HAVING MIN(snapshot_date) > DATE(@baselineDate)
        ),
        observed_daily AS (
          SELECT
            first_seen_users.date,
            COUNT(DISTINCT first_seen_users.user_id) AS registrations
          FROM first_seen_users
          JOIN \`${projectId}.${LSTEP_DATASET}.user_tags\` AS tags
            ON tags.user_id = first_seen_users.user_id
            AND tags.snapshot_date = first_seen_users.date
          WHERE tags.tag_name IN UNNEST(@tagNames)
            AND tags.tag_flag = 1
          GROUP BY first_seen_users.date
        ),
        historical_daily AS (
          SELECT
            DATE(date_string) AS date,
            COUNT(*) AS registrations
          FROM UNNEST(@backfillDates) AS date_string
          GROUP BY date
        ),
        combined_daily AS (
          SELECT * FROM observed_daily
          UNION ALL
          SELECT * FROM historical_daily
        )
        SELECT
          date,
          SUM(registrations) AS registrations
        FROM combined_daily
        WHERE date >= DATE_SUB(CURRENT_DATE("Asia/Tokyo"), INTERVAL 365 DAY)
        GROUP BY date
        ORDER BY date
      `,
      params: {
        tagNames: [...YOKO_LINE_REGISTRATION_TAG_NAMES],
        baselineDate: YOKO_LINE_REGISTRATION_BASELINE_DATE,
        backfillDates: [...YOKO_LINE_REGISTRATION_BACKFILL_DATES],
      },
    }),
    bigquery.query({
      query: `
        SELECT
          snapshot_date,
          COUNT(DISTINCT IF(tag_flag = 1, user_id, NULL)) AS registrations
        FROM \`${projectId}.${LSTEP_DATASET}.user_tags\`
        WHERE tag_name IN UNNEST(@tagNames)
          AND snapshot_date >= DATE_SUB(CURRENT_DATE("Asia/Tokyo"), INTERVAL 365 DAY)
        GROUP BY snapshot_date
        ORDER BY snapshot_date DESC
      `,
      params: { tagNames: [...YOKO_LINE_REGISTRATION_TAG_NAMES] },
    }),
  ]);

  return summarizeYokoMetrics(
    clickResult[0] as ClickRow[],
    dailyRegistrationResult[0] as DailyRegistrationRow[],
    registrationResult[0] as RegistrationSnapshotRow[],
  );
}
