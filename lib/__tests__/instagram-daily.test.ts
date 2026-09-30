import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildInstagramDailyRows } from '../instagram-daily';

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
