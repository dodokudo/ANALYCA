import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
let snapshot = '2026-11-05';
let followerRows: Array<{date: string; followers_count: number}> = [{ date: '2026-11-03', followers_count: 3374 }, { date: '2026-11-04', followers_count: 3377 }];
const queries: Array<{query: string; params: Record<string, unknown>}> = [];
mock.module('@google-cloud/bigquery', { namedExports: { BigQuery: class {
  async query(options: {query: string; params: Record<string, unknown>}) {
    queries.push(options);
    if (options.query.includes('.threads_posts')) return [[{ threads_id: 'one', text: '投稿', permalink: 'https://example.test', views: 100, likes: 2 }]];
    if (options.query.includes('.threads_daily_metrics')) return [followerRows];
    return [[{ clicks: 6 }]];
  }
} } });
mock.module('../yoko-agency-metrics', { namedExports: { getYokoAgencyMetrics: async () => ({ latestSnapshotDate: snapshot, daily: [] }) } });
const { getYokoDailyReport } = await import('../yoko-daily-report-data');

test('対象アカウントの日本時間の投稿と前日差を集計し、取得済みの登録0人を保持する', async () => {
  const report = await getYokoDailyReport('2026-11-04', new Date('2026-11-05T02:00:00Z'));
  assert.equal(report.followers, 3377);
  assert.equal(report.followerGrowth, 3);
  assert.equal(report.lineRegistrations, 0);
  assert.equal(report.linkClicks, 6);
  assert.ok(queries.every(options => options.params.userId === '33833959932919231'));
  assert.match(queries[0].query, /DATE\(timestamp, 'Asia\/Tokyo'\)/);
  assert.equal(queries[1].params.previous, '2026-11-03');
});

test('前日記録や翌朝のLINEスナップショットが欠けたら0ではなく未取得にする', async () => {
  followerRows = [{ date: '2026-11-04', followers_count: 3377 }];
  snapshot = '2026-11-04';
  const report = await getYokoDailyReport('2026-11-04');
  assert.equal(report.followers, 3377);
  assert.equal(report.followerGrowth, null);
  assert.equal(report.lineRegistrations, null);
});
