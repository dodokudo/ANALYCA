import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { registerHooks } from 'node:module';
import { GRANDPRIX_EVENTS } from './threads-grandprix-events.ts';
import { GRANDPRIX_ENTRY_COOKIE } from './threads-grandprix-entry-session.ts';

process.env.PROJECT_ID = 'test-project';
process.env.THREADS_APP_SECRET = 'test-only-secret';
process.env.ADMIN_PASSWORD = 'test-admin';
process.env.CRON_SECRET = 'test-cron';
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(['next/server', 'next/headers'].includes(specifier) ? `${specifier}.js` : specifier, context);
} });
const { NextRequest } = await import('next/server.js');
const jobs = [];
const queries = [];
const db = {
  query: async options => { queries.push(options); return [[]]; },
  createQueryJob: async options => { jobs.push(options); return [{ getQueryResults: async () => [[]] }]; },
};
mock.module('@google-cloud/bigquery', { namedExports: { BigQuery: class { constructor() { return db; } } } });
mock.module('next/headers.js', { namedExports: { cookies: async () => ({ get: () => undefined }) } });
mock.module('../app/threads-grandprix/grandprix-bigquery.ts', { namedExports: {
  fetchGrandprixEvents: async () => GRANDPRIX_EVENTS,
  getBigQueryClient: () => db, projectId: 'test-project',
  jstDateString: () => '2026-10-21',
  shiftDate: (date, offset) => new Date(Date.parse(date) + offset * 86_400_000).toISOString().slice(0, 10),
} });
let connectionFails = false;
mock.module('./threads-grandprix-connection.ts', { namedExports: {
  checkGrandprixConnection: async () => { if (connectionFails) throw new Error('temporary'); return { status: 'connected', userId: 'private-id' }; },
} });
const entry = await import('../app/api/threads-grandprix/entry/route.ts');
const admin = await import('../app/api/admin/threads-grandprix/entries/route.ts');
const snapshot = await import('../app/api/threads-grandprix/snapshot/route.ts');
const connect = await import('../app/api/threads-grandprix/connect/route.ts');
const request = (eventId) => new NextRequest('https://example.test/api/threads-grandprix/entry', {
  method: 'POST', body: JSON.stringify({ eventId, lineName: 'Test', threadsUsername: '@Example' }),
});

test('legacy requests and closed/unknown events cannot write autumn entries', async () => {
  jobs.length = 0;
  assert.equal((await entry.POST(request(undefined))).status, 409);
  assert.equal((await entry.POST(request('2026-summer'))).status, 409);
  assert.equal((await entry.POST(request('missing'))).status, 404);
  assert.equal(jobs.length, 0);
});

test('explicit autumn entry is isolated by event and returns a signed receipt without private IDs', async () => {
  mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-18T00:00:00Z') });
  try {
    const response = await entry.POST(request('2026-autumn'));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, connectionStatus: 'connected' });
    assert.match(response.headers.get('set-cookie'), /HttpOnly/);
    const merge = jobs.find(job => job.query.includes('MERGE'));
    assert.equal(merge.params.eventId, '2026-autumn');
    assert.equal(merge.params.normalizedThreadsUsername, 'example');
    assert.match(merge.query, /COALESCE\(target.event_id, ''\) = source.event_id/);
    const cookie = response.cookies.get(GRANDPRIX_ENTRY_COOKIE).value;
    const followup = new NextRequest('https://example.test/api/threads-grandprix/entry', { headers: { cookie: `${GRANDPRIX_ENTRY_COOKIE}=${cookie}` } });
    assert.equal((await entry.GET(followup)).status, 200);
    const redirect = await connect.GET(followup);
    const url = new URL(redirect.headers.get('location'));
    assert.equal(url.hostname, 'threads.com');
    assert.equal(url.searchParams.get('state'), `grandprix.${cookie}`);
    connectionFails = true;
    const retry = await entry.POST(request('2026-autumn'));
    assert.deepEqual(await retry.json(), { success: true, connectionStatus: 'needs_check' });
    assert.ok(retry.cookies.get(GRANDPRIX_ENTRY_COOKIE));
  } finally { connectionFails = false; mock.timers.reset(); }
});

test('unauthenticated status requests cannot expose connection status', async () => {
  assert.equal((await entry.GET(new NextRequest('https://example.test/api/entry'))).status, 401);
});

test('admin queries filter the selected event and reject unknown events', async () => {
  queries.length = 0;
  const response = await admin.GET(new Request('https://example.test/api/admin/entries?event=2026-summer', { headers: { 'x-admin-password': 'test-admin' } }));
  assert.equal(response.status, 200);
  assert.equal(queries.at(-1).params.eventId, '2026-summer');
  assert.match(queries.at(-1).query, /WHERE e.event_id = @eventId/);
  const bad = await admin.GET(new Request('https://example.test/api/admin/entries?event=invalid', { headers: { 'x-admin-password': 'test-admin' } }));
  assert.equal(bad.status, 404);
});

test('snapshot processes autumn only during its dates and never rewrites summer', async () => {
  jobs.length = 0;
  const before = await snapshot.GET(new NextRequest('https://example.test/api/snapshot?date=2026-10-19', { headers: { authorization: 'Bearer test-cron' } }));
  assert.deepEqual((await before.json()).results, []);
  const during = await snapshot.GET(new NextRequest('https://example.test/api/snapshot?date=2026-10-20', { headers: { authorization: 'Bearer test-cron' } }));
  assert.deepEqual((await during.json()).results, [{ eventId: '2026-autumn', snapshotDate: '2026-10-20' }]);
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every(job => job.params.eventId === '2026-autumn'));
  assert.match(jobs[1].query, /WHERE e.event_id = @eventId/);
});
