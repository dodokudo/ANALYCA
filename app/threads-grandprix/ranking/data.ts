import { BigQuery } from '@google-cloud/bigquery';

export type RankingScopeKey = 'today' | 'yesterday' | 'monthly';

export type FollowerRankingRow = {
  rank: number;
  lineName: string;
  threadsUsername: string;
  followerDelta: number;
  followersCount: number;
};

export type PostRankingRow = {
  rank: number;
  lineName: string;
  threadsUsername: string;
  views: number;
  likes: number;
  replies: number;
  permalink: string;
  text: string;
};

export type RankingScope = {
  key: RankingScopeKey;
  label: string;
  dateLabel: string;
  followerRanking: FollowerRankingRow[];
  postRanking: PostRankingRow[];
};

export type RankingData = {
  generatedAt: string;
  scopes: RankingScope[];
};

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
  if (!projectId) {
    throw new Error('PROJECT_ID is not configured.');
  }

  if (!bigqueryClient) {
    bigqueryClient = new BigQuery({
      projectId,
      credentials: parseCredentials(credentialsJson),
    });
  }

  return bigqueryClient;
}

function formatMd(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  return `${Number(month)}/${Number(day)}`;
}

function jstDateString(date = new Date()): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}-${String(jst.getUTCDate()).padStart(2, '0')}`;
}

function shiftDate(dateStr: string, deltaDays: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function normalizeText(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function toNumber(value: unknown): number {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

async function fetchFollowerRanking(startDate: string, endDate: string): Promise<FollowerRankingRow[]> {
  const [rows] = await getBigQueryClient().query({
    query: `
      WITH participants AS (
        SELECT
          e.line_name,
          e.normalized_threads_username,
          u.user_id,
          u.threads_username
        FROM \`${projectId}.analyca.threads_grandprix_entries\` e
        JOIN \`${projectId}.analyca.users\` u
          ON LOWER(REGEXP_REPLACE(TRIM(u.threads_username), r'^@', '')) = e.normalized_threads_username
      ),
      metrics AS (
        SELECT
          user_id,
          SUM(COALESCE(follower_delta, 0)) AS follower_delta,
          ARRAY_AGG(COALESCE(followers_count, 0) ORDER BY date DESC LIMIT 1)[SAFE_OFFSET(0)] AS followers_count
        FROM \`${projectId}.analyca.threads_daily_metrics\`
        WHERE date BETWEEN @startDate AND @endDate
        GROUP BY user_id
      )
      SELECT
        p.line_name,
        p.threads_username,
        COALESCE(m.follower_delta, 0) AS follower_delta,
        COALESCE(m.followers_count, 0) AS followers_count
      FROM participants p
      JOIN metrics m
        ON m.user_id = p.user_id
      ORDER BY follower_delta DESC, followers_count DESC
      LIMIT 5
    `,
    params: { startDate, endDate },
  });

  return rows.map((row, index) => ({
    rank: index + 1,
    lineName: String(row.line_name || ''),
    threadsUsername: String(row.threads_username || ''),
    followerDelta: toNumber(row.follower_delta),
    followersCount: toNumber(row.followers_count),
  }));
}

async function fetchPostRanking(startDate: string, endDate: string): Promise<PostRankingRow[]> {
  const [rows] = await getBigQueryClient().query({
    query: `
      WITH participants AS (
        SELECT
          e.line_name,
          e.normalized_threads_username,
          u.user_id,
          u.threads_username
        FROM \`${projectId}.analyca.threads_grandprix_entries\` e
        JOIN \`${projectId}.analyca.users\` u
          ON LOWER(REGEXP_REPLACE(TRIM(u.threads_username), r'^@', '')) = e.normalized_threads_username
      )
      SELECT
        p.line_name,
        p.threads_username,
        COALESCE(tp.views, 0) AS views,
        COALESCE(tp.likes, 0) AS likes,
        COALESCE(tp.replies, 0) AS replies,
        tp.permalink,
        tp.text
      FROM participants p
      JOIN \`${projectId}.analyca.threads_posts\` tp
        ON tp.user_id = p.user_id
      WHERE DATE(tp.timestamp, 'Asia/Tokyo') BETWEEN DATE(@startDate) AND DATE(@endDate)
      ORDER BY views DESC, likes DESC
      LIMIT 5
    `,
    params: { startDate, endDate },
  });

  return rows.map((row, index) => ({
    rank: index + 1,
    lineName: String(row.line_name || ''),
    threadsUsername: String(row.threads_username || ''),
    views: toNumber(row.views),
    likes: toNumber(row.likes),
    replies: toNumber(row.replies),
    permalink: String(row.permalink || ''),
    text: normalizeText(row.text).slice(0, 90),
  }));
}

export async function getGrandprixRankingData(): Promise<RankingData> {
  const today = jstDateString();
  const yesterday = shiftDate(today, -1);
  const monthStart = '2026-07-07';

  const scopeDefs: Array<{
    key: RankingScopeKey;
    label: string;
    dateLabel: string;
    startDate: string;
    endDate: string;
  }> = [
    {
      key: 'today',
      label: '今日',
      dateLabel: `${formatMd(today)}集計`,
      startDate: today,
      endDate: today,
    },
    {
      key: 'yesterday',
      label: '昨日',
      dateLabel: `${formatMd(yesterday)}集計`,
      startDate: yesterday,
      endDate: yesterday,
    },
    {
      key: 'monthly',
      label: '月間',
      dateLabel: `${formatMd(monthStart)}〜${formatMd(today)}`,
      startDate: monthStart,
      endDate: today,
    },
  ];

  const scopes = await Promise.all(
    scopeDefs.map(async (scope) => {
      const [followerRanking, postRanking] = await Promise.all([
        fetchFollowerRanking(scope.startDate, scope.endDate),
        fetchPostRanking(scope.startDate, scope.endDate),
      ]);

      return {
        key: scope.key,
        label: scope.label,
        dateLabel: scope.dateLabel,
        followerRanking,
        postRanking,
      };
    }),
  );

  return {
    generatedAt: new Date().toISOString(),
    scopes,
  };
}
