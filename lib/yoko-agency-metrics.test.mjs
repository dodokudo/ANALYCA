import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeYokoMetrics } from './yoko-agency-metrics.ts';

test('uses first Threads-tag observation for daily registrations and latest snapshot for total', () => {
  const result = summarizeYokoMetrics(
    [
      { date: '2026-08-11', link_clicks: 2 },
      { date: '2026-08-12', link_clicks: 3 },
    ],
    [
      { date: '2026-08-11', registrations: 1 },
      { date: '2026-08-12', registrations: 2 },
    ],
    [
      { snapshot_date: '2026-08-12', registrations: 14 },
      { snapshot_date: '2026-08-11', registrations: 11 },
    ],
  );

  assert.equal(result.linkClicks, 5);
  assert.equal(result.lineRegistrations, 14);
  assert.equal(result.previousLineRegistrations, 11);
  assert.equal(result.latestSnapshotDate, '2026-08-12');
  assert.deepEqual(result.daily[1], {
    date: '2026-08-12',
    linkClicks: 3,
    lineRegistrations: 2,
  });
});

test('returns zero metrics before the first L-step snapshot', () => {
  const result = summarizeYokoMetrics([], [], []);
  assert.equal(result.lineRegistrations, 0);
  assert.equal(result.previousLineRegistrations, 0);
  assert.equal(result.latestSnapshotDate, null);
});
