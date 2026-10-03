import assert from 'node:assert/strict';
import test from 'node:test';
import { buildThreadsMonthlyReport, getReportMonths, toJstDate, type MonthlyReportPost } from '../threads-monthly-report.ts';

const now = new Date('2026-10-03T12:00:00Z');
const makePost = (id: string, timestamp: string, views = 10): MonthlyReportPost => ({
  id, threads_id: id, timestamp, text: id, views, likes: 2, replies: 1,
});

test('month choices start in August and change at Japanese midnight', () => {
  assert.deepEqual(getReportMonths(now), ['2026-08', '2026-09', '2026-10']);
  assert.deepEqual(getReportMonths(new Date('2026-08-31T15:00:00Z')), ['2026-08', '2026-09']);
  assert.deepEqual(getReportMonths(new Date('2026-07-31T14:59:59Z')), []);
  assert.equal(toJstDate('2026-08-31T15:00:00Z'), '2026-09-01');
});

test('counts unique posts within JST month boundaries and excludes cumulative follower snapshot views', () => {
  const report = buildThreadsMonthlyReport({
    month: '2026-08', now,
    posts: [
      makePost('before', '2026-07-31T14:59:59Z', 999),
      makePost('first', '2026-07-31T15:00:00Z', 20),
      makePost('first', '2026-07-31T15:00:00Z', 20),
      makePost('last', '2026-08-31T14:59:59Z', 30),
      makePost('next', '2026-08-31T15:00:00Z', 999),
    ],
    followerMetrics: [
      { date: '2026-07-31', followers_count: 100, follower_delta: 0 },
      { date: '2026-08-01', followers_count: 102, follower_delta: 2 },
      { date: '2026-08-31', followers_count: 125, follower_delta: 23 },
    ],
    agencyMetrics: {
      latestSnapshotDate: '2026-10-03',
      daily: [{ date: '2026-08-10', lineRegistrations: 3, linkClicks: 0 }, { date: '2026-09-25', lineRegistrations: 1, linkClicks: 2 }],
    },
  });
  assert.equal(report.posts.length, 2);
  assert.equal(report.views, 50);
  assert.equal(report.likes, 4);
  assert.equal(report.followerGrowth, 25);
  assert.equal(report.followers, 125);
  assert.equal(report.days.length, 31);
  assert.equal(report.days[0].views, 20);
  assert.equal(report.days[30].views, 30);
  assert.equal(report.days[2].followers, null);
  assert.equal(report.days[30].followerGrowth, null); // No preceding-day measurement.
  assert.equal(report.linkClicks, null); // No click records in August, not a measured zero.
  assert.equal(report.lineRegistrations, 3);
});

test('limits the current month to today and identifies partial coverage', () => {
  const report = buildThreadsMonthlyReport({
    month: '2026-10', now,
    posts: [makePost('today', '2026-10-03T01:00:00Z'), makePost('future', '2026-10-04T01:00:00Z')],
    followerMetrics: [
      { date: '2026-09-30', followers_count: 200, follower_delta: 2 },
      { date: '2026-10-01', followers_count: 213, follower_delta: 13 },
      { date: '2026-10-02', followers_count: 210, follower_delta: -3 },
    ],
    agencyMetrics: { latestSnapshotDate: '2026-10-02', daily: [{ date: '2026-10-02', linkClicks: 5, lineRegistrations: 2 }] },
  });
  assert.equal(report.endDate, '2026-10-03');
  assert.equal(report.isCurrentMonth, true);
  assert.equal(report.days.length, 3);
  assert.equal(report.posts.length, 1);
  assert.equal(report.followerDate, '2026-10-02');
  assert.equal(report.followerGrowth, 10);
  assert.equal(report.days[0].followerGrowth, 13);
  assert.equal(report.days[1].followerGrowth, -3);
  assert.equal(report.linkClicks, 5);
  assert.equal(report.clickRecordsFrom, '2026-10-02');
  assert.equal(report.days[0].linkClicks, null);
  assert.equal(report.days[2].linkClicks, 0);
  assert.equal(report.days[2].lineRegistrations, null);
});

test('does not invent a completed-month growth or missing agency measurements', () => {
  const report = buildThreadsMonthlyReport({
    month: '2026-09', now, posts: [], agencyMetrics: null,
    followerMetrics: [
      { date: '2026-08-31', followers_count: 100, follower_delta: 0 },
      { date: '2026-09-29', followers_count: 140, follower_delta: 40 },
    ],
  });
  assert.equal(report.followerGrowth, null);
  assert.equal(report.followers, 140);
  assert.equal(report.linkClicks, null);
  assert.equal(report.lineRegistrations, null);
  assert.throws(() => buildThreadsMonthlyReport({ month: '2026-07', now, posts: [], followerMetrics: [], agencyMetrics: null }));
  assert.throws(() => buildThreadsMonthlyReport({ month: '2026-11', now, posts: [], followerMetrics: [], agencyMetrics: null }));
});
