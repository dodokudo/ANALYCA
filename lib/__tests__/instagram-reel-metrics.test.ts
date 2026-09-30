import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReelMetrics, readInsightValues, compareNullableMetrics, rateReelMetric } from '../instagram-reel-metrics';
import { fetchReelInsightValues } from '../instagram-reel-metrics-server';

test('watch times use milliseconds; skip percentage is not scaled; rate denominators match AutoStudio', () => {
  const row = normalizeReelMetrics('1', { views: 2000, saved: 14, ig_reels_avg_watch_time: 21488, ig_reels_video_view_total_time: 38313292, reels_skip_rate: 42.4 }, 68.288);
  assert.equal(row.avgWatchSeconds, 21.488);
  assert.equal(row.totalWatchSeconds, 38313.292);
  assert.equal(row.skipRate, 42.4);
  assert.ok(Math.abs(row.saveRate! - .7) < 1e-10);
  assert.ok(Math.abs(row.retentionRate! - 31.4667) < .0001);
});

test('missing, real zero and undefined ratios remain distinct; replay retention can exceed 100%', () => {
  const values = readInsightValues([{ name: 'views', values: [{ value: 0 }] }, { name: 'reach', values: [] }, { name: 'saved', total_value: { value: 0 } }, { name: 'likes', values: [{ value: null }] }]);
  const row = normalizeReelMetrics('1', values, 0);
  assert.equal(row.views, 0); assert.equal(row.saved, 0);
  assert.equal(row.reach, null); assert.equal(row.likes, null);
  assert.equal(row.avgWatchSeconds, null); assert.equal(row.saveRate, null); assert.equal(row.retentionRate, null);
  assert.equal(normalizeReelMetrics('1', { ig_reels_avg_watch_time: 12000 }, 10).retentionRate, 120);
  assert.equal(normalizeReelMetrics('1', { ig_reels_avg_watch_time: 0 }, 10).retentionRate, 0);
});

test('skip rating is inverted; ties share rank; missing samples excluded', () => {
  assert.deepEqual(rateReelMetric(10, [10, 20, 30, 40, null], true), { level: 'high', rank: 1, total: 4 });
  assert.equal(rateReelMetric(10, [10, 20, 30, 40]).level, 'low');
  assert.deepEqual(rateReelMetric(20, [10, 20, 20, 30]), { level: 'mid', rank: 2, total: 4 });
  assert.equal(rateReelMetric(0, [0, 0, 0, 0]).level, 'mid');
  assert.equal(rateReelMetric(null, [1, 2]).rank, null);
});

test('missing metrics sort last in both directions without mutating the input', () => {
  const input = [null, 0, 30, 2];
  assert.deepEqual([...input].sort((a, b) => compareNullableMetrics(a, b, 'asc')), [0, 2, 30, null]);
  assert.deepEqual([...input].sort((a, b) => compareNullableMetrics(a, b, 'desc')), [30, 2, 0, null]);
});

test('unsupported metric falls back individually and preserves available metrics', async t => {
  t.mock.method(globalThis, 'fetch', async (input: URL) => {
    const metric = input.searchParams.get('metric');
    if (metric?.includes(',') || metric === 'shares') return Response.json({ error: { code: 100 } }, { status: 400 });
    return Response.json({ data: [{ name: metric, values: [{ value: metric === 'views' ? 201 : 0 }] }] });
  });
  const result = await fetchReelInsightValues('https://graph.instagram.com/v25.0', '1', 'fake-test-token');
  assert.equal(result.views, 201); assert.equal(result.saved, 0); assert.equal(result.reels_skip_rate, 0);
  assert.equal(result.shares, undefined);
});

test('auth or rate errors do not fan out into per-metric retries or become zero', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ error: { code: 190 } }, { status: 400 }); });
  assert.deepEqual(await fetchReelInsightValues('https://graph.instagram.com/v25.0', '1', 'fake-test-token'), {});
  assert.equal(calls, 2);
});

test('scheduled collection reuses DB duration and never refetches the video for existing reels', async t => {
  const { collectReelMetrics } = await import('../instagram-reel-metrics-server');
  t.mock.method(globalThis, 'fetch', async (input: URL) => {
    assert.ok(input.pathname.endsWith('/insights'), 'video metadata must not be fetched when DB duration is known');
    const names = input.searchParams.get('metric')!.split(',');
    return Response.json({ data: names.map(name => ({ name, values: [{ value: name === 'ig_reels_avg_watch_time' ? 10000 : 100 }] })) });
  });
  const row = await collectReelMetrics('known-reel', 'fake', 'https://graph.instagram.com/v25.0', 50);
  assert.equal(row.durationSeconds, 50);
  assert.equal(row.retentionRate, 20);
  assert.equal(row.status, 'complete');
});
