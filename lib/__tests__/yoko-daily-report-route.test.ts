import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
let reads = 0;
let sends = 0;
const startAt = '2026-11-06T11:00:00+09:00';
mock.module('next/server.js', { namedExports: { NextResponse: Response } });
mock.module('../yoko-daily-report-data', { namedExports: { getYokoDailyReport: async (date: string) => {
  reads++;
  return { date, generatedAt: new Date().toISOString(), followers: null, followerGrowth: null, linkClicks: 0, lineRegistrations: null, lineSnapshotDate: null, posts: [] };
} } });
mock.module('../yoko-daily-report-config', { namedExports: { YOKO_DAILY_REPORT_ENABLED: true, YOKO_DAILY_REPORT_START_AT: startAt, YOKO_DAILY_REPORT_DESTINATION: { id: 'test', name: 'test' } } });
mock.module('../yoko-daily-report-delivery', { namedExports: {
  deliverDailyReport: async () => { sends++; return { sent: true, delivery: { state: 'sent' } }; },
  requestDailyFlex: async (_destination: unknown, _date: string, _message: unknown, validateOnly: boolean) => {
    assert.equal(validateOnly, true);
    return { groupName: 'test', messageId: null };
  },
} });
const { GET } = await import('../../app/api/cron/yoko-daily-report/route');

test('認証必須・開始日時前は送信しない・dryRunは検証のみ・11月6日11時から送信する', async () => {
  const previous = process.env.CRON_SECRET;
  const clock = mock.method(Date, 'now', () => new Date('2026-11-05T11:00:00+09:00').getTime());
  try {
    delete process.env.CRON_SECRET;
    assert.equal((await GET(new Request('https://analyca.jp/api/cron/yoko-daily-report'))).status, 401);
    process.env.CRON_SECRET = 'test-only';
    assert.equal((await GET(new Request('https://analyca.jp/api/cron/yoko-daily-report'))).status, 401);
    const headers = { authorization: 'Bearer test-only' };
    const blocked = await GET(new Request('https://analyca.jp/api/cron/yoko-daily-report', { headers }));
    const blockedBody = await blocked.json();
    assert.equal(blockedBody.sent, false);
    assert.equal(blockedBody.startsAt, startAt);
    assert.equal(reads, 0);
    const preview = await GET(new Request('https://analyca.jp/api/cron/yoko-daily-report?dryRun=true', { headers }));
    assert.equal(preview.status, 200);
    assert.match(preview.headers.get('cache-control')!, /no-store/);
    assert.equal((await preview.json()).sent, false);
    assert.equal(reads, 1);
    assert.equal(sends, 0);
    clock.mock.mockImplementation(() => new Date(startAt).getTime() - 1);
    const beforeStart = await GET(new Request('https://analyca.jp/api/cron/yoko-daily-report', { headers }));
    assert.equal((await beforeStart.json()).sent, false);
    assert.equal(sends, 0);
    clock.mock.mockImplementation(() => new Date(startAt).getTime());
    const atStart = await GET(new Request('https://analyca.jp/api/cron/yoko-daily-report', { headers }));
    const initialDelivery = await atStart.json();
    assert.equal(initialDelivery.sent, true);
    assert.equal(initialDelivery.date, '2026-11-05');
    assert.equal(sends, 1);
  } finally {
    clock.mock.restore();
    if (previous === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previous;
  }
});
