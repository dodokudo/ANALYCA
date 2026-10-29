import assert from 'node:assert/strict';
import { beforeEach, mock, test } from 'node:test';
import { registerHooks } from 'node:module';
import { createThreadsReauthSession, readThreadsReauthSession, threadsReauthReturnTo, THREADS_REAUTH_COOKIE } from '../threads-reauth-session.ts';
import { saveThreadsReauthDraft, takeThreadsReauthDraft } from '../threads-reauth-draft.ts';

process.env.THREADS_APP_SECRET = 'test-only-secret';
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === 'next/server' ? 'next/server.js' : specifier, context);
} });
const { NextRequest, NextResponse } = await import('next/server.js');
mock.module('next/server.js', { namedExports: { NextRequest, NextResponse, after: () => {} } });
let user;
let authenticatedId;
let exchangeCount;
let saved;
let posts;
let postsFail;
let planBlocked;
mock.module('../bigquery.ts', { namedExports: {
  getUserById: async () => user,
  findUserIdByThreadsId: async () => 'user-1',
  upsertThreadsUser: async data => { saved.push(data); return 'user-1'; },
  updateLastLogin: async () => {},
} });
mock.module('../bigqueryScheduledPosts.ts', { namedExports: {
  listScheduledPosts: async () => { if (postsFail) throw new Error('History unavailable'); return posts; },
} });
mock.module('../threads.ts', { namedExports: { ThreadsAPI: class {
  static async exchangeCodeForShortToken() { exchangeCount++; return { access_token: 'short', user_id: authenticatedId }; }
  static async exchangeForLongTermToken() { return 'new-token'; }
  async getAccountInfo() { return { id: authenticatedId, username: 'fixture' }; }
} } });
mock.module('../media/auth.ts', { namedExports: {
  configuredMediaAdminIds: () => new Set(), createMediaAdminSession: () => { throw new Error('Unexpected admin session'); }, MEDIA_ADMIN_SESSION_COOKIE: 'admin',
} });
mock.module('../univapay/plans.ts', { namedExports: {
  resolveEffectivePlanId: () => 'fixture', isChannelBlockedByPlan: () => planBlocked,
} });
const { GET: callback } = await import('../../app/api/auth/threads/callback/route.ts');
const { GET: reconnect } = await import('../../app/api/auth/threads/reconnect/route.ts');
const { GET: status } = await import('../../app/api/auth/threads/status/route.ts');
beforeEach(() => {
  user = { user_id: 'user-1', has_threads: true, threads_user_id: 'threads-1', threads_access_token: 'saved-token' };
  authenticatedId = 'threads-1'; exchangeCount = 0; saved = []; posts = []; postsFail = false; planBlocked = false;
});

test('return destination is limited to the original dashboard and preserves the tab', () => {
  const path = '/user-1?tab=threads&threadsTab=schedule&scheduleId=post-1&auth=old#editor';
  assert.equal(threadsReauthReturnTo('user-1', path), '/user-1?tab=threads&threadsTab=schedule&scheduleId=post-1#editor');
  for (const value of ['https://evil.test', '//evil.test', '/\\evil.test', '/other-user', '/user-1/../other-user']) {
    assert.equal(threadsReauthReturnTo('user-1', value), '/user-1?tab=threads');
  }
});

test('signed reauthentication sessions reject tampering and expiration', () => {
  const value = createThreadsReauthSession('user-1', 'threads-1', '/user-1?tab=instagram', 1000);
  assert.equal(readThreadsReauthSession(value, 1001).threadsUserId, 'threads-1');
  assert.equal(readThreadsReauthSession(value + 'x', 1001), null);
  assert.equal(readThreadsReauthSession(value, 1000 + 1800000), null);
});

async function start() {
  const response = await reconnect(new NextRequest('https://analyca.jp/api/auth/threads/reconnect?userId=user-1&returnTo=' + encodeURIComponent('/user-1?tab=threads&threadsTab=schedule&scheduleId=post-1')));
  const url = new URL(response.headers.get('location'));
  const receipt = response.cookies.get(THREADS_REAUTH_COOKIE).value;
  assert.equal(url.hostname, 'threads.com');
  assert.equal(url.searchParams.get('state'), `reauth.${receipt}`);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
  return { receipt, state: url.searchParams.get('state') };
}
function returning({ receipt, state }, query = 'code=fixture') {
  const url = new URL(`https://analyca.jp/api/auth/threads/callback?${query}`);
  url.searchParams.set('state', state);
  return new NextRequest(url, { headers: { cookie: `${THREADS_REAUTH_COOKIE}=${receipt}` } });
}

test('successful reauthentication updates only the original account, restores tab and signals success', async () => {
  const response = await callback(returning(await start()));
  const url = new URL(response.headers.get('location'));
  assert.equal(url.pathname, '/user-1');
  assert.equal(url.searchParams.get('threadsTab'), 'schedule');
  assert.equal(url.searchParams.get('scheduleId'), 'post-1');
  assert.equal(url.searchParams.get('reauth'), 'success');
  assert.equal(url.searchParams.get('auth'), 'threads_complete');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].user_id, 'user-1');
  assert.equal(response.cookies.get(THREADS_REAUTH_COOKIE).value, '');
});

test('cancelled authorization returns to the original tab without writing or retrying', async () => {
  const response = await callback(returning(await start(), 'error=access_denied'));
  const url = new URL(response.headers.get('location'));
  assert.equal(url.searchParams.get('reauth'), 'cancelled');
  assert.equal(url.searchParams.get('threadsTab'), 'schedule');
  assert.equal(exchangeCount, 0);
  assert.equal(saved.length, 0);
});

test('wrong account and changed account mapping cannot overwrite credentials', async () => {
  const flow = await start();
  authenticatedId = 'other-threads';
  assert.match((await callback(returning(flow))).headers.get('location'), /reauth=wrong_account/);
  assert.equal(saved.length, 0);
  authenticatedId = 'threads-1';
  user.threads_user_id = 'new-mapping';
  assert.match((await callback(returning(flow))).headers.get('location'), /reauth=wrong_account/);
  assert.equal(saved.length, 0);
});

test('missing/mismatched state cookie fails before exchanging a code', async () => {
  const flow = await start();
  flow.receipt = 'invalid';
  assert.match((await callback(returning(flow))).headers.get('location'), /login\/threads\?error=/);
  assert.equal(exchangeCount, 0);
  assert.equal(saved.length, 0);
});

test('status validates current auth independently of post history and only counts unresolved auth failures', async () => {
  let apiBody = { id: 'threads-1' };
  let apiStatus = 200;
  const stub = mock.method(globalThis, 'fetch', async () => Response.json(apiBody, { status: apiStatus }));
  const authError = JSON.stringify({ error: { code: 190 } });
  posts = [
    { schedule_id: 'failed', status: 'failed', error_message: authError },
    { schedule_id: 'partial', status: 'partial', error_message: authError },
    { schedule_id: 'posted', status: 'posted', error_message: authError },
    { schedule_id: 'other', status: 'failed', error_message: 'Image upload failed' },
  ];
  const request = () => new NextRequest('https://analyca.jp/api/auth/threads/status?userId=user-1&includeFailures=1');
  try {
    const response = await status(request());
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const result = await response.json();
    assert.deepEqual(result, { status: 'connected', failedCount: 2, failedScheduleId: 'failed' });
    assert.equal(JSON.stringify(result).includes('saved-token'), false);
    postsFail = true;
    assert.deepEqual(await (await status(request())).json(), { status: 'connected', failedCount: null, failedScheduleId: null });
    apiStatus = 400; apiBody = { error: { code: 190 } };
    assert.equal((await (await status(request())).json()).status, 'reauth_required');
    apiStatus = 503; apiBody = { error: { code: 2 } };
    assert.equal((await (await status(request())).json()).status, 'unknown');
    user.has_threads = false;
    assert.equal((await (await status(request())).json()).status, 'not_connected');
    assert.equal(saved.length, 0);
  } finally { stub.mock.restore(); }
});

test('draft recovery preserves unpublished edits, media and original schedule identity, then consumes them', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const data = { scheduledAt: '2026-11-01T09:30', mainText: '編集中の文章', comment1: '返信', comment2: '', comment3: '', comment4: '', comment5: '', comment6: '', comment7: '', mediaItems: [{ url: 'https://example.test/image.jpg', type: 'IMAGE' }], comment1MediaItems: [], comment2MediaItems: [] };
  saveThreadsReauthDraft(storage, 'user-1', data, { scheduleId: 'post-1', mainThreadId: 'already-posted' }, 1000);
  assert.equal(takeThreadsReauthDraft(storage, 'other-user', 1001), null);
  const draft = takeThreadsReauthDraft(storage, 'user-1', 1001);
  assert.equal(draft.mainText, data.mainText);
  assert.deepEqual(draft.mediaItems, data.mediaItems);
  assert.equal(draft.scheduleId, 'post-1');
  assert.equal(draft.mainThreadId, 'already-posted');
  assert.equal(draft.scheduledAtJst, '2026-11-01T09:30:00+09:00');
  assert.equal(takeThreadsReauthDraft(storage, 'user-1', 1002), null);
  saveThreadsReauthDraft(storage, 'user-1', data, null, 1000);
  assert.equal(takeThreadsReauthDraft(storage, 'user-1', 1001).scheduleId, '');
  saveThreadsReauthDraft(storage, 'user-1', data, null, 1000);
  assert.equal(takeThreadsReauthDraft(storage, 'user-1', 1000 + 7200000), null);
  assert.throws(() => saveThreadsReauthDraft({ setItem: () => {}, getItem: () => null }, 'user-1', data, null));
});
