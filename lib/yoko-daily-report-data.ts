import { BigQuery } from '@google-cloud/bigquery';
import { getYokoAgencyMetrics } from './yoko-agency-metrics';
import { shiftReportDay, YOKO_DAILY_USER_ID, type YokoDailyReport } from './yoko-daily-report';

function text(value: unknown): string {
  return String(value && typeof value === 'object' && 'value' in value ? value.value : value ?? '');
}

export async function getYokoDailyReport(date: string, now: Date = new Date()): Promise<YokoDailyReport> {
  const previous = shiftReportDay(date, -1);
  const next = shiftReportDay(date, 1);
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID || 'mark-454114';
  if (!/^[\w-]+$/.test(projectId)) throw new Error('Project configuration is invalid');
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS || '{}');
  const client = new BigQuery({ projectId, credentials, location: 'asia-northeast1' });
  const params = { userId: YOKO_DAILY_USER_ID, date, previous };
  const [posts, followers, clicks, agency] = await Promise.all([
    client.query({ query: `SELECT threads_id, text, permalink, views, likes FROM \`${projectId}.analyca.threads_posts\`
      WHERE user_id = @userId AND DATE(timestamp, 'Asia/Tokyo') = DATE(@date)
      QUALIFY ROW_NUMBER() OVER (PARTITION BY threads_id ORDER BY updated_at DESC) = 1`, params }),
    client.query({ query: `SELECT date, followers_count FROM \`${projectId}.analyca.threads_daily_metrics\`
      WHERE user_id = @userId AND date IN (@date, @previous)
      QUALIFY ROW_NUMBER() OVER (PARTITION BY date ORDER BY updated_at DESC) = 1`, params }),
    client.query({ query: `SELECT COUNT(*) AS clicks FROM \`${projectId}.analyca.option_click_logs\`
      WHERE user_id = @userId AND DATE(clicked_at, 'Asia/Tokyo') = DATE(@date)
      AND NOT REGEXP_CONTAINS(LOWER(COALESCE(user_agent, '')), 'curl|notebot|bot|crawler|spider|preview')`, params }),
    getYokoAgencyMetrics(),
  ]);
  const current = followers[0].find(row => text(row.date) === date);
  const prior = followers[0].find(row => text(row.date) === previous);
  const known = (value: unknown): number | null => value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value);
  const count = known(current?.followers_count);
  const priorCount = known(prior?.followers_count);
  return {
    date, generatedAt: now.toISOString(), followers: count,
    followerGrowth: count !== null && priorCount !== null ? count - priorCount : null,
    linkClicks: Number(clicks[0][0].clicks),
    lineRegistrations: agency.latestSnapshotDate && agency.latestSnapshotDate >= next
      ? agency.daily.find(row => row.date === date)?.lineRegistrations ?? 0 : null,
    lineSnapshotDate: agency.latestSnapshotDate,
    posts: posts[0].map(row => ({ id: text(row.threads_id), text: text(row.text), url: text(row.permalink), views: Number(row.views ?? 0), likes: Number(row.likes ?? 0) })),
  };
}
