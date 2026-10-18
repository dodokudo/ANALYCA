import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

let rows = [];
mock.module('../app/threads-grandprix/grandprix-bigquery.ts', { namedExports: {
  projectId: 'test-project',
  getBigQueryClient: () => ({ query: async () => [rows] }),
} });
const { checkGrandprixConnection } = await import('./threads-grandprix-connection.ts');
const user = { user_id: 'internal-id', threads_user_id: 'threads-id', threads_username: 'example', has_threads: true,
  threads_access_token: 'test-token', threads_token_expires_at: '2099-01-01T00:00:00Z' };
const responses = [];
mock.method(globalThis, 'fetch', async () => {
  const next = responses.shift();
  if (!next) throw new Error('No network allowed in tests');
  return Response.json(next.body, { status: next.status || 200 });
});

test('new, expired, and ambiguous accounts do not count as connected', async () => {
  rows = [];
  assert.equal((await checkGrandprixConnection('example')).status, 'not_connected');
  rows = [{ ...user, threads_token_expires_at: '2026-01-01' }];
  assert.equal((await checkGrandprixConnection('example')).status, 'reconnect_required');
  rows = [user, user];
  assert.equal((await checkGrandprixConnection('example')).status, 'needs_check');
});

test('valid profile and readable followers metric allow reconnect to be skipped', async () => {
  rows = [user];
  responses.push({ body: { id: 'threads-id', username: 'example' } },
    { body: { data: [{ name: 'followers_count', total_value: { value: 0 } }] } });
  assert.equal((await checkGrandprixConnection('example')).status, 'connected');
});

test('revoked authorization requests reconnect; temporary failures request a retry', async () => {
  rows = [user];
  responses.push({ status: 400, body: { error: { code: 190 } } });
  assert.equal((await checkGrandprixConnection('example')).status, 'reconnect_required');
  responses.push({ body: { id: 'threads-id', username: 'example' } }, { status: 403, body: { error: { code: 10 } } });
  assert.equal((await checkGrandprixConnection('example')).status, 'reconnect_required');
  assert.equal((await checkGrandprixConnection('example')).status, 'needs_check');
  responses.push({ body: { id: 'threads-id', username: 'different' } });
  assert.equal((await checkGrandprixConnection('example')).status, 'needs_check');
});
