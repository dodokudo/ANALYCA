import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { registerHooks } from 'node:module';
import { YokoNotionError } from '../yoko-notion-errors';

let syncFailure: Error | null = null;
let generationFailure: Error | null = null;
let generationCalls = 0;
const events: string[] = [];
registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === 'next/server' ? 'next/server.js' : specifier, context);
  },
});
mock.module('next/server.js', { namedExports: { NextResponse: Response } });
mock.module('../yoko-notion-ledger', { namedExports: { YOKO_ANALYCA_USER_ID: '33833959932919231' } });
mock.module('../yoko-notion-sync', { namedExports: {
  syncYokoNotionContentBatch: async () => {
    events.push('sync');
    if (syncFailure) throw syncFailure;
    return { processed: 0, remaining: 0, complete: true };
  },
} });
mock.module('../threads-content-drafts', { namedExports: {
  generateYokoDraftBatch: async () => {
    events.push('generate');
    generationCalls++;
    if (generationFailure) throw generationFailure;
    return [{ id: 'draft' }];
  },
} });
const { POST } = await import('../../app/api/threads/content-drafts/generate/route');
const request = (userId = '33833959932919231') => new Request('https://example.test/generate', {
  method: 'POST', body: JSON.stringify({ userId }),
}) as Parameters<typeof POST>[0];

test('failed synchronization stops generation and explains authentication recovery', async () => {
  syncFailure = new YokoNotionError(401, 'API token is invalid.');
  const response = await POST(request());
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /認証.*管理者/);
  assert.equal(generationCalls, 0);
  syncFailure = null;
});

test('successful sync still precedes generation', async () => {
  events.length = 0;
  const response = await POST(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { drafts: [{ id: 'draft' }] });
  assert.deepEqual(events, ['sync', 'generate']);
});

test('Notion failure while loading generation guidance is also actionable', async () => {
  generationFailure = new YokoNotionError(403, 'private upstream detail');
  const response = await POST(request());
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.match(body.error, /アクセス権/);
  assert.doesNotMatch(body.error, /private upstream detail/);
  generationFailure = null;
});

test('unsupported accounts do not sync or generate', async () => {
  events.length = 0;
  assert.equal((await POST(request('other'))).status, 403);
  assert.deepEqual(events, []);
});
