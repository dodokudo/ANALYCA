import assert from 'node:assert/strict';
import test from 'node:test';
import {
  summarizeYokoMetrics,
  YOKO_LINE_REGISTRATION_BACKFILL_DATES,
  YOKO_LINE_REGISTRATION_BASELINE_DATE,
  YOKO_LINE_REGISTRATION_TAG_NAMES,
} from './yoko-agency-metrics.ts';

test('counts all four Threads registration tags', () => {
  assert.deepEqual(YOKO_LINE_REGISTRATION_TAG_NAMES, [
    'Threads：固定',
    'Threads',
    'Threads：プロフィール',
    '【流入経路】Threads',
  ]);
});

test('backfills the six verified August registrations before reliable snapshots', () => {
  assert.equal(YOKO_LINE_REGISTRATION_BASELINE_DATE, '2026-09-20');
  assert.deepEqual(YOKO_LINE_REGISTRATION_BACKFILL_DATES, [
    '2026-08-05',
    '2026-08-11',
    '2026-08-16',
    '2026-08-17',
    '2026-08-19',
    '2026-08-22',
  ]);
});

test('combines daily registrations with the latest snapshot total', () => {
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
