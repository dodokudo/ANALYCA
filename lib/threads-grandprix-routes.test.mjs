import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { registerHooks } from 'node:module';
import { GRANDPRIX_EVENTS, GRANDPRIX_LINE_GROUP_URL } from './threads-grandprix-events.ts';
import { createGrandprixEntrySession, GRANDPRIX_ENTRY_COOKIE } from './threads-grandprix-entry-session.ts';

process.env.PROJECT_ID = 'test-project';
process.env.THREADS_APP_SECRET = 'test-only-secret';
process.env.ADMIN_PASSWORD = 'test-admin';
process.env.CRON_SECRET = 'test-cron';
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(['next/server', 'next/headers'].includes(specifier) ? `${specifier}.js` : specifier, context);
} });
const { NextRequest, NextResponse } = await import('next/server.js');
const afterJobs = [];
mock.module('next/server.js', { namedExports: { NextRequest, NextResponse, after: fn => afterJobs.push(fn) } });
const onboarding = [];
mock.module('./threads-grandprix-onboarding.ts', { namedExports: { sendGrandprixOnboardingEmail: async args => onboarding.push(args) } });
let existingUser = false;
const jobs = [];
const queries = [];
let transactionError = '';
const db = {
  query: async options => { queries.push(options); return [existingUser && options.query.includes('SELECT user_id') ? [{ user_id: 'existing-user' }] : []]; },
  createQueryJob: async options => { jobs.push(options); return [{ getQueryResults: async () => {
    if (options.query.includes('BEGIN TRANSACTION') && transactionError) throw new Error(transactionError);
    return [[]];
  } }]; },
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
  method: 'POST', body: JSON.stringify({ eventId, lineName: 'Test', threadsUsername: '@Example', email: 'fixture@example.test' }),
});

test('legacy requests and closed/unknown events cannot write autumn entries', async () => {
  jobs.length = 0;
  assert.equal((await entry.POST(request(undefined))).status, 409);
  assert.equal((await entry.POST(request('2026-summer'))).status, 409);
  assert.equal((await entry.POST(request('missing'))).status, 404);
  assert.equal(jobs.length, 0);
});

test('entry goes to LINE without checking Threads and only queues email for a new dashboard', async () => {
  mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-18T00:00:00Z') });
  try {
    connectionFails = true;
    const response = await entry.POST(request('2026-autumn'));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, lineGroupUrl: GRANDPRIX_LINE_GROUP_URL });
    assert.equal(onboarding.length, 0);
    assert.equal(afterJobs.length, 1);
    await afterJobs.pop()();
    assert.equal(onboarding[0].email, 'fixture@example.test');
    const merge = jobs.find(job => job.query.includes('MERGE'));
    assert.equal(merge.params.eventId, '2026-autumn');
    assert.equal(merge.params.normalizedThreadsUsername, 'example');
    assert.equal(merge.params.email, 'fixture@example.test');
    assert.match(merge.query, /COALESCE\(target.event_id, ''\) = source.event_id/);
    existingUser = true;
    assert.equal((await entry.POST(request('2026-autumn'))).status, 200);
    assert.equal(afterJobs.length, 0);
  } finally { existingUser = false; connectionFails = false; mock.timers.reset(); }
});

test('invalid email cannot save an entry or queue an email', async () => {
  const before = jobs.length;
  const response = await entry.POST(new NextRequest('https://example.test/api/threads-grandprix/entry', {
    method: 'POST', body: JSON.stringify({ eventId: '2026-autumn', lineName: 'Test', threadsUsername: 'example', email: 'bad' }),
  }));
  assert.equal(response.status, 400);
  assert.equal(jobs.length, before);
  assert.equal(afterJobs.length, 0);
});

test('email login starts OAuth in a fresh browser with no entry cookie', async () => {
  const response = await connect.GET(new NextRequest('https://example.test/api/threads-grandprix/connect?event=2026-autumn'));
  const url = new URL(response.headers.get('location'));
  assert.equal(url.hostname, 'threads.com');
  assert.match(url.searchParams.get('state'), /^grandprix-login\./);
  assert.match(response.headers.get('set-cookie'), /grandprixLogin=.*HttpOnly/);
  const invalid = await connect.GET(new NextRequest('https://example.test/api/threads-grandprix/connect?event=2026-summer'));
  assert.match(invalid.headers.get('location'), /login\/threads\?error=/);
});

test('legacy signed entry links remain supported', async () => {
  const receipt = createGrandprixEntrySession('2026-autumn', 'example');
  const response = await connect.GET(new NextRequest('https://example.test/api/threads-grandprix/connect', { headers: { cookie: `${GRANDPRIX_ENTRY_COOKIE}=${receipt}` } }));
  assert.equal(new URL(response.headers.get('location')).searchParams.get('state'), `grandprix.${receipt}`);
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

const linkRequest = (overrides = {}, authenticated = true) => new Request('https://example.test/api/admin/entries', {
  method: 'PATCH', headers: authenticated ? { 'x-admin-password': 'test-admin' } : {},
  body: JSON.stringify({ entryId: 'autumn-entry', eventId: '2026-autumn', userId: 'member-id', expectedUsername: 'mistyped', ...overrides }),
});

test('member lookup and linking require admin authentication', async () => {
  const before = jobs.length;
  assert.equal((await admin.PATCH(linkRequest({}, false))).status, 401);
  assert.equal((await admin.GET(new Request('https://example.test/api/admin/entries?searchUser=example'))).status, 401);
  assert.equal(jobs.length, before);
});

test('member search uses a parameterized query and exposes only ID and username', async () => {
  const response = await admin.GET(new Request('https://example.test/api/admin/entries?searchUser=%40Example', {
    headers: { 'x-admin-password': 'test-admin' },
  }));
  assert.equal(response.status, 200);
  assert.equal(queries.at(-1).params.search, 'example');
  assert.match(queries.at(-1).query, /SELECT user_id, threads_username FROM/);
  assert.doesNotMatch(queries.at(-1).query, /access_token/);
});

test('invalid linking requests cannot mutate entries', async () => {
  const before = jobs.length;
  assert.equal((await admin.PATCH(linkRequest({ userId: '' }))).status, 400);
  assert.equal((await admin.PATCH(linkRequest({ eventId: 'invalid' }))).status, 404);
  assert.equal(jobs.length, before);
});

test('admin linking preserves the submitted ID and updates only the selected event entry', async () => {
  assert.equal((await admin.PATCH(linkRequest())).status, 200);
  const job = jobs.at(-1);
  assert.deepEqual(job.params, { entryId: 'autumn-entry', eventId: '2026-autumn', userId: 'member-id', expectedUsername: 'mistyped' });
  assert.match(job.query, /BEGIN TRANSACTION/);
  assert.match(job.query, /original_threads_username = COALESCE\(original_threads_username, threads_username\)/);
  assert.match(job.query, /WHERE id = @entryId AND event_id = @eventId;/);
  assert.doesNotMatch(job.query, /SET has_analyca_at_entry|SET analyca_user_id_at_entry/);
});

test('stale entries, nonexistent or ambiguous users, and duplicate links return actionable conflicts', async () => {
  try {
    for (const code of ['ENTRY_CHANGED', 'USER_NOT_FOUND', 'AMBIGUOUS_USER', 'ALREADY_LINKED']) {
      transactionError = code;
      const response = await admin.PATCH(linkRequest());
      assert.equal(response.status, 409);
      assert.equal((await response.json()).success, false);
    }
  } finally { transactionError = ''; }
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
