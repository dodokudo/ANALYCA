import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildInstagramDailyRows, summarizeInstagramDailyRange } from '../instagram-daily';

test('orders dates newest first and calculates signed changes against the previous day', () => {
  const rows = buildInstagramDailyRows([
    { date: '2026-09-28', followers_count: 2426 },
    { date: '2026-09-30', followers_count: 2430 },
    { date: '2026-09-29', followers_count: 2435 },
  ], []);
  assert.deepEqual(rows.map(row => [row.date, row.followerGrowth]), [
    ['2026-09-30', -5], ['2026-09-29', 9], ['2026-09-28', null],
  ]);
});

test('preserves the previous month baseline when filtering a display range', () => {
  const rows = buildInstagramDailyRows([
    { date: '2026-08-31', followers_count: 100 },
    { date: '2026-09-01', followers_count: 103 },
  ], []).filter(row => row.date.startsWith('2026-09'));
  assert.equal(rows[0].followerGrowth, 3);
});

test('does not interpret a missing previous day as a daily increase', () => {
  const rows = buildInstagramDailyRows([
    { date: '2026-09-26', followers_count: 100 },
    { date: '2026-09-28', followers_count: 110 },
  ], []);
  assert.equal(rows[0].followerGrowth, null);
});

test('uses per-day aggregates and that days followers for story view rate', () => {
  const rows = buildInstagramDailyRows([
    { date: '2026-09-26', followers_count: 1084 },
    { date: '2026-09-27', followers_count: 1086 },
  ], [{ date: '2026-09-26', postCount: 60, storyPostCount: 80, storyReach: 171 }]);
  assert.equal(rows[1].postCount, 60);
  assert.equal(rows[1].storyPostCount, 80);
  assert.equal(rows[1].storyViewRate, 171 / 1084);
  assert.equal(rows[0].storyPostCount, 0);
  assert.equal(rows[0].storyReach, 0);
  assert.equal(rows[0].storyViewRate, null);
});

test('distinguishes missing metrics from zero and avoids division by zero', () => {
  const insights = [{ date: '2026-09-26', followers_count: 0 }];
  const missing = buildInstagramDailyRows(insights, undefined)[0];
  assert.equal(missing.postCount, null);
  assert.equal(missing.storyReach, null);
  const noReach = buildInstagramDailyRows(insights, [
    { date: '2026-09-26', postCount: 1, storyPostCount: 1, storyReach: null },
  ])[0];
  assert.equal(noReach.storyReach, null);
  assert.equal(noReach.storyViewRate, null);
});

test('summary distinguishes unavailable days and follower history from measured zero', async () => {
  const { summarizeInstagramDailyRows } = await import('../instagram-daily');
  const rows = buildInstagramDailyRows([
    { date: '2026-10-26', followers_count: null, reach: 10, profile_views: 2, website_clicks: 0 },
    { date: '2026-10-27', followers_count: 100, reach: 20, profile_views: 3, website_clicks: 0 },
  ], []);
  assert.deepEqual(summarizeInstagramDailyRows(rows, 2), {
    totalReach: 30, totalProfileViews: 5, totalWebClicks: 0, followerGrowth: null, complete: true,
  });
  assert.equal(summarizeInstagramDailyRows(rows, 7).totalReach, null);
  assert.equal(summarizeInstagramDailyRows([], 7).totalWebClicks, null);
});

test('chart extents keep measured zeros and leave missing history unknown', async () => {
  const { instagramMetricExtent } = await import('../instagram-daily');
  assert.deepEqual(instagramMetricExtent([null, undefined]), { min: null, max: null });
  assert.deepEqual(instagramMetricExtent([0, 12, null]), { min: 0, max: 12 });
});

test('uses API follows and unfollows when historical follower totals are unavailable', () => {
  const [row] = buildInstagramDailyRows([{ date: '2026-10-25', followers_count: null, follows: 7, unfollows: 3 }], []);
  assert.equal(row.followerGrowth, 4);
  assert.equal(row.followers_count, null);
});

test('period growth uses exact boundary snapshots despite missing intermediate days', async () => {
  const { summarizeInstagramDailyRows } = await import('../instagram-daily');
  const rows = buildInstagramDailyRows([
    { date: '2026-10-21', followers_count: 22445 },
    { date: '2026-10-22', followers_count: 22461 },
    { date: '2026-10-25', followers_count: null, follows: 21, unfollows: 13 },
    { date: '2026-10-27', followers_count: 22496 },
  ], []);
  const result = summarizeInstagramDailyRows(rows, 7, { date: '2026-10-20', followers_count: 22427 });
  assert.equal(result.followerGrowth, 69);
  assert.equal(result.totalReach, null);
  assert.equal(rows.find(row => row.date === '2026-10-27')!.followerGrowth, null);
});

test('missing period boundaries cannot be replaced with nearby dates or zero', async () => {
  const { summarizeInstagramDailyRows } = await import('../instagram-daily');
  const rows = buildInstagramDailyRows([{ date: '2026-10-26', followers_count: 120 }], []);
  assert.equal(summarizeInstagramDailyRows(rows, 7, { date: '2026-10-20', followers_count: 100 }).followerGrowth, null);
  assert.equal(summarizeInstagramDailyRows(rows, 6, { date: '2026-10-20', followers_count: null }).followerGrowth, null);
});

test('boundary growth preserves zero, decreases and single-day ranges', async () => {
  const { summarizeInstagramDailyRows } = await import('../instagram-daily');
  for (const [before, after, expected] of [[100, 100, 0], [100, 97, -3], [0, 2, 2]]) {
    const rows = buildInstagramDailyRows([{ date: '2026-10-27', followers_count: after }], []);
    assert.equal(summarizeInstagramDailyRows(rows, 1, { date: '2026-10-26', followers_count: before }).followerGrowth, expected);
  }
});

test('current month and seven-day funnels remain visible after midnight before the next sync', () => {
  const insights = [
    { date: '2026-09-30', followers_count: 100 },
    ...Array.from({ length: 27 }, (_, i) => ({
      date: `2026-10-${String(i + 1).padStart(2, '0')}`,
      followers_count: 101 + i, reach: 10, profile_views: 2, website_clicks: 0,
    })),
  ];
  // A newer LINE-only row must not advance the Instagram collection date.
  const rows = buildInstagramDailyRows(insights, [], [{ date: '2026-10-28', followers: 20, registrations: 1 }]);
  assert.deepEqual(summarizeInstagramDailyRange(rows, '2026-10-01', '2026-10-28', '2026-10-27'), {
    totalReach: 270, totalProfileViews: 54, totalWebClicks: 0, followerGrowth: 27, complete: true,
  });
  assert.deepEqual(summarizeInstagramDailyRange(rows, '2026-10-22', '2026-10-28', '2026-10-27'), {
    totalReach: 60, totalProfileViews: 12, totalWebClicks: 0, followerGrowth: 6, complete: true,
  });
  const synced = buildInstagramDailyRows([
    ...insights, { date: '2026-10-28', followers_count: 128, reach: 5, profile_views: 1, website_clicks: 1 },
  ], []);
  assert.equal(summarizeInstagramDailyRange(synced, '2026-10-01', '2026-10-28', '2026-10-28').totalReach, 275);
});

test('range summary preserves past ranges and does not conceal gaps within collected history', () => {
  const rows = buildInstagramDailyRows([
    { date: '2026-09-30', followers_count: 100 },
    { date: '2026-10-01', followers_count: 102, reach: 10 },
    { date: '2026-10-03', followers_count: 106, reach: 20 },
  ], []);
  const past = summarizeInstagramDailyRange(rows, '2026-10-01', '2026-10-01', '2026-10-03');
  assert.equal(past.totalReach, 10);
  assert.equal(past.followerGrowth, 2);
  const gap = summarizeInstagramDailyRange(rows, '2026-10-01', '2026-10-04', '2026-10-03');
  assert.equal(gap.totalReach, null);
  assert.equal(gap.followerGrowth, 6);
  assert.equal(gap.complete, false);
});

test('uncollected month and missing account data remain unknown rather than zero', () => {
  const rows = buildInstagramDailyRows([{ date: '2026-10-31', followers_count: 100, reach: 10 }], []);
  for (const latest of ['2026-10-31', undefined]) {
    const result = summarizeInstagramDailyRange(rows, '2026-11-01', '2026-11-01', latest);
    assert.equal(result.totalReach, null);
    assert.equal(result.followerGrowth, null);
    assert.equal(result.complete, false);
  }
});
