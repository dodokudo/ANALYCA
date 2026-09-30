import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { normalizeReelMetrics, getSavedReelMetrics } from '../instagram-reel-metrics';

const writes: Array<{ query: string; params: Record<string, unknown> }> = [];
const timestamp = '2026-09-30T11:00:00.000Z';
class FakeBigQuery {
  dataset() { return {}; }
  async query({ query, params }: { query: string; params: Record<string, unknown> }) {
    assert.match(query, /m.user_id AND r.instagram_id = m.instagram_id/);
    assert.equal(params.user_id, 'account-a');
    return [[{
      instagram_id: 'reel-a', timestamp: { value: timestamp }, views: 999, like_count: 10,
      stored_metrics: { instagram_id: 'reel-a', snapshot_at: { value: timestamp }, views: 100, reach: 80,
        likes: 0, comments: 0, saved: 2, shares: 0, avg_watch_seconds: 12.25, total_watch_seconds: 900.125,
        skip_rate: 40.5, duration_seconds: 50 },
    }]];
  }
  async createQueryJob(options: { query: string; params: Record<string, unknown> }) {
    writes.push(options);
    return [{ getQueryResults: async () => [[]] }];
  }
}
mock.module('@google-cloud/bigquery', { namedExports: { BigQuery: FakeBigQuery } });
const { getUserReels, saveInstagramReelMetricSnapshots } = await import('../bigquery');

test('dashboard reads complete account-scoped metrics from DB without any network fetch', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Dashboard must not call Instagram'); });
  const [reel] = await getUserReels('account-a');
  assert.equal(reel.views, 100); assert.equal(reel.like_count, 0);
  assert.equal(reel.metrics?.avgWatchSeconds, 12.25);
  assert.equal(reel.metrics?.totalWatchSeconds, 900.125);
  assert.equal(reel.metrics?.retentionRate, 24.5);
  assert.equal(reel.metrics?.saveRate, 2);
  assert.equal(reel.metrics?.skipRate, 40.5);
  assert.equal(reel.metrics?.fetchedAt, timestamp);
  assert.equal(reel.metrics?.status, 'complete');
});

test('snapshot write excludes failed collections, preserves zero and scopes the account', async () => {
  const failed = normalizeReelMetrics('failed', {}, null);
  const valid = normalizeReelMetrics('valid', { views: 0, likes: 0 }, null);
  assert.equal(await saveInstagramReelMetricSnapshots('account-a', [failed]), 0);
  assert.equal(writes.length, 0);
  assert.equal(await saveInstagramReelMetricSnapshots('account-a', [failed, valid]), 1);
  assert.equal(writes[0].params.user_id, 'account-a');
  const saved = JSON.parse(String(writes[0].params.rows));
  assert.equal(saved.length, 1); assert.equal(saved[0].views, 0); assert.equal(saved[0].reach, null);
  assert.ok(!('mediaUrl' in saved[0]));
  assert.match(writes[0].query, /INSERT INTO/);
});

test('legacy DB watch values display immediately while unavailable metrics remain missing', () => {
  const metrics = getSavedReelMetrics({ id: 'old', views: 200, saved: 0, avg_watch_time_seconds: 6.5, video_view_total_time_hours: '1.5' });
  assert.equal(metrics.avgWatchSeconds, 6.5); assert.equal(metrics.totalWatchSeconds, 5400);
  assert.equal(metrics.saveRate, 0); assert.equal(metrics.skipRate, null); assert.equal(metrics.retentionRate, null);
  assert.equal(getSavedReelMetrics({ id: 'old', video_view_total_time_hours: '' }).totalWatchSeconds, null);
});
