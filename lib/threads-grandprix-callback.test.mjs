import assert from 'node:assert/strict';
import { beforeEach, mock, test } from 'node:test';
import { registerHooks } from 'node:module';
import { createGrandprixEntrySession, GRANDPRIX_ENTRY_COOKIE } from './threads-grandprix-entry-session.ts';

import { createGrandprixLoginSession, GRANDPRIX_LOGIN_COOKIE } from './threads-grandprix-login-session.ts';

process.env.THREADS_APP_SECRET = 'test-only-secret';
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === 'next/server' ? 'next/server.js' : specifier, context);
} });
const { NextRequest, NextResponse } = await import('next/server.js');
const syncJobs = [];
mock.module('next/server.js', { namedExports: { NextRequest, NextResponse, after: fn => syncJobs.push(fn) } });
mock.module('./media/auth.ts', { namedExports: {
  configuredMediaAdminIds: () => new Set(), createMediaAdminSession: () => { throw new Error('Unexpected admin session'); }, MEDIA_ADMIN_SESSION_COOKIE: 'admin-session',
} });
let username = 'example';
let exchangeCount = 0;
let savedCount = 0;
let blocked = false;
let existingUserId = 'fixture-user';
let savedUser;
mock.module('./threads.ts', { namedExports: { ThreadsAPI: class {
  static async exchangeCodeForShortToken() { exchangeCount++; return { access_token: 'short', user_id: 'threads-id' }; }
  static async exchangeForLongTermToken() { return 'long'; }
  async getAccountInfo() { return { id: 'threads-id', username }; }
} } });
mock.module('./bigquery.ts', { namedExports: {
  getUserById: async () => ({ plan_id: 'fixture-plan' }), findUserIdByThreadsId: async () => existingUserId,
  upsertThreadsUser: async data => { savedCount++; savedUser = data; return existingUserId || 'new-user'; }, updateLastLogin: async () => {},
} });
mock.module('./univapay/plans.ts', { namedExports: {
  resolveEffectivePlanId: () => 'fixture-plan', isChannelBlockedByPlan: () => blocked,
} });
const { GET } = await import('../app/api/auth/threads/callback/route.ts');
beforeEach(() => {
  username = 'example'; exchangeCount = 0; savedCount = 0; blocked = false;
  existingUserId = 'fixture-user'; savedUser = undefined; syncJobs.length = 0;
});
const receipt = createGrandprixEntrySession('2026-autumn', 'example');
function request(state = `grandprix.${receipt}`, cookie = receipt) {
  const url = new URL('https://example.test/api/auth/threads/callback?code=fixture');
  if (state) url.searchParams.set('state', state);
  return new NextRequest(url, { headers: cookie ? { cookie: `${GRANDPRIX_ENTRY_COOKIE}=${cookie}` } : {} });
}

test('missing or mismatched signed state blocks OAuth before token exchange', async () => {
  assert.match((await GET(request(undefined, 'wrong'))).headers.get('location'), /connection=expired/);
  assert.equal(exchangeCount, 0);
  assert.equal(savedCount, 0);
});

test('a mistyped entry ID does not block saving the authenticated Threads account', async () => {
  username = 'someone_else';
  assert.match((await GET(request())).headers.get('location'), /connection=complete/);
  assert.equal(savedCount, 1);
  assert.equal(savedUser.threads_username, 'someone_else');
  assert.equal(savedUser.threads_user_id, 'threads-id');
});

test('existing channel plan restrictions are preserved', async () => {
  blocked = true;
  assert.match((await GET(request())).headers.get('location'), /connection=plan_required/);
  assert.equal(savedCount, 0);
  blocked = false;
});

test('matching autumn connection returns to entry and schedules initial data retrieval', async () => {
  const response = await GET(request());
  assert.match(response.headers.get('location'), /threads-grandprix\/autumn\?connection=complete/);
  assert.equal(savedCount, 1);
  assert.equal(syncJobs.length, 1);
});

test('ordinary Threads OAuth still returns to the user dashboard', async () => {
  const response = await GET(request('', ''));
  assert.match(response.headers.get('location'), /fixture-user\?tab=threads&auth=threads_complete&syncing=true/);
  assert.equal(syncJobs.length, 0);
});

function emailLoginRequest(extra = '') {
  const token = createGrandprixLoginSession('2026-autumn');
  return new NextRequest(`https://example.test/api/auth/threads/callback?code=fixture&state=grandprix-login.${token}${extra}`, {
    headers: { cookie: `${GRANDPRIX_LOGIN_COOKIE}=${token}` },
  });
}

test('email login identifies the entrant and opens the dashboard without returning to the LP', async () => {
  const response = await GET(emailLoginRequest());
  assert.match(response.headers.get('location'), /fixture-user\?tab=threads&auth=threads_complete&syncing=true/);
  assert.equal(response.cookies.get('analycaUserId').value, 'fixture-user');
});

test('email login saves an unmatched existing account for later admin linking', async () => {
  username = 'enkaku.hadou.healing33';
  const response = await GET(emailLoginRequest());
  assert.match(response.headers.get('location'), /fixture-user\?tab=threads/);
  assert.equal(savedCount, 1);
  assert.equal(savedUser.user_id, 'fixture-user');
  assert.equal(savedUser.threads_username, username);
  assert.equal(response.cookies.get('analycaUserId').value, 'fixture-user');
  assert.equal(response.cookies.get(GRANDPRIX_LOGIN_COOKIE).value, '');
});

test('email login creates a member even without a matching entry', async () => {
  existingUserId = null;
  username = 'unmatched';
  const response = await GET(emailLoginRequest());
  assert.match(response.headers.get('location'), /new-user\?tab=threads/);
  assert.equal(savedUser.user_id, undefined);
  assert.equal(savedUser.threads_username, 'unmatched');
  assert.equal(response.cookies.get('analycaUserId').value, 'new-user');
});

test('email login denial preserves the event so the user can retry', async () => {
  const response = await GET(emailLoginRequest('&error=access_denied'));
  const url = new URL(response.headers.get('location'));
  assert.equal(url.pathname, '/login/threads');
  assert.equal(url.searchParams.get('grandprix'), '2026-autumn');
  assert.ok(url.searchParams.get('error'));
});

test('email login state cannot be replayed without its browser cookie', async () => {
  const before = exchangeCount;
  const token = createGrandprixLoginSession('2026-autumn');
  const response = await GET(new NextRequest(`https://example.test/api/auth/threads/callback?code=fixture&state=grandprix-login.${token}`));
  assert.match(response.headers.get('location'), /login\/threads\?error=/);
  assert.equal(exchangeCount, before);
});
