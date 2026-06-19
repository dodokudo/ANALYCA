import { BigQuery } from '@google-cloud/bigquery';

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID || 'mark-454114';
const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS || '{}';

const LINKS_DATASET = 'autostudio_links';
const LSTEP_DATASET = 'autostudio_lstep';
const YAMAZAKI_START_DATE = '2026-06-17';
const YAMAZAKI_SHORT_CODE = '6m_ag';
const YAMAZAKI_TAG_NAME = 'YAMAZAKI';
const BOT_USER_AGENT_PATTERN = 'curl|notebot|bot|crawler|spider|preview';

export const YAMAZAKI_ANALYCA_USER_ID = '26743384212021461';
export const YAMAZAKI_THREADS_USERNAME = 'zakiyamadesu_0608';

export interface YamazakiAgencyDailyMetric {
  date: string;
  linkClicks: number;
  lineRegistrations: number;
}

export interface YamazakiAgencyMetrics {
  startDate: string;
  endDate: string;
  linkClicks: number;
  lineRegistrations: number;
  daily: YamazakiAgencyDailyMetric[];
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
  if (typeof value === 'string') return Number(value) || 0;
  return 0;
}

function toDateString(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value && typeof value === 'object' && 'value' in value) {
    return String((value as { value: unknown }).value).slice(0, 10);
  }
  return String(value ?? '').slice(0, 10);
}

export async function getYamazakiAgencyMetrics(): Promise<YamazakiAgencyMetrics> {
  const [rows] = await bigquery.query({
    query: `
      WITH params AS (
        SELECT
          DATE(@startDate) AS start_date,
          CURRENT_DATE("Asia/Tokyo") AS end_date
      ),
      date_window AS (
        SELECT
          start_date,
          end_date,
          DATE_SUB(start_date, INTERVAL DATE_DIFF(end_date, start_date, DAY) + 1 DAY) AS previous_start_date
        FROM params
      ),
      agency_links AS (
        SELECT id
        FROM \`${projectId}.${LINKS_DATASET}.short_links\`
        WHERE short_code = @shortCode
      ),
      link_clicks AS (
        SELECT
          DATE(clicked_at, "Asia/Tokyo") AS date,
          COUNT(*) AS link_clicks
        FROM \`${projectId}.${LINKS_DATASET}.click_logs\`, date_window
        WHERE short_link_id IN (SELECT id FROM agency_links)
          AND DATE(clicked_at, "Asia/Tokyo") BETWEEN date_window.previous_start_date AND date_window.end_date
          AND NOT REGEXP_CONTAINS(LOWER(COALESCE(user_agent, "")), @botPattern)
        GROUP BY date
      ),
      latest_core AS (
        SELECT MAX(snapshot_date) AS snapshot_date
        FROM \`${projectId}.${LSTEP_DATASET}.user_core\`
      ),
      latest_tags AS (
        SELECT MAX(snapshot_date) AS snapshot_date
        FROM \`${projectId}.${LSTEP_DATASET}.user_tags\`
        WHERE tag_name = @tagName
      ),
      yamazaki_users AS (
        SELECT DISTINCT tags.user_id
        FROM \`${projectId}.${LSTEP_DATASET}.user_tags\` tags
        JOIN latest_tags
          ON tags.snapshot_date = latest_tags.snapshot_date
        WHERE tags.tag_name = @tagName
          AND tags.tag_flag = 1
      ),
      line_registrations AS (
        SELECT
          SAFE.PARSE_DATE('%Y-%m-%d', SUBSTR(core.friend_added_at, 1, 10)) AS date,
          COUNT(DISTINCT core.user_id) AS line_registrations
        FROM \`${projectId}.${LSTEP_DATASET}.user_core\` core
        JOIN latest_core
          ON core.snapshot_date = latest_core.snapshot_date
        JOIN date_window
          ON TRUE
        INNER JOIN yamazaki_users yu
          ON core.user_id = yu.user_id
        WHERE SAFE.PARSE_DATE('%Y-%m-%d', SUBSTR(core.friend_added_at, 1, 10))
          BETWEEN date_window.previous_start_date AND date_window.end_date
        GROUP BY date
      ),
      dates AS (
        SELECT date FROM link_clicks
        UNION DISTINCT
        SELECT date FROM line_registrations
      )
      SELECT
        dates.date,
        COALESCE(link_clicks.link_clicks, 0) AS link_clicks,
        COALESCE(line_registrations.line_registrations, 0) AS line_registrations
      FROM dates
      LEFT JOIN link_clicks USING (date)
      LEFT JOIN line_registrations USING (date)
      ORDER BY date
    `,
    params: {
      startDate: YAMAZAKI_START_DATE,
      shortCode: YAMAZAKI_SHORT_CODE,
      tagName: YAMAZAKI_TAG_NAME,
      botPattern: BOT_USER_AGENT_PATTERN,
    },
  });

  const daily = (rows as Record<string, unknown>[]).map((row) => ({
    date: toDateString(row.date),
    linkClicks: toNumber(row.link_clicks),
    lineRegistrations: toNumber(row.line_registrations),
  }));

  return {
    startDate: YAMAZAKI_START_DATE,
    endDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date()),
    linkClicks: daily
      .filter((row) => row.date >= YAMAZAKI_START_DATE)
      .reduce((sum, row) => sum + row.linkClicks, 0),
    lineRegistrations: daily
      .filter((row) => row.date >= YAMAZAKI_START_DATE)
      .reduce((sum, row) => sum + row.lineRegistrations, 0),
    daily,
  };
}
