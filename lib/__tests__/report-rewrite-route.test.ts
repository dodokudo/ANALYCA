import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mock, test } from 'node:test';
import { emptyRewrite } from '../report-rewrite';

const original = { revision: 4, fields: { summary: '原文\n絶対に消さない', results: '成果', improvements: '課題', nextMonth: '来月' }, savedAt: '2026-11-04T15:49:23Z' };
let writes = 0;
let legacyWrites = 0;
let failRead = false;
let failWrite = false;
class ReflectionConflict extends Error {}
mock.module('next/server.js', { namedExports: { NextResponse: Response } });
mock.module('../report-reflection-repository', { namedExports: {
  ReflectionConflict,
  reflectionRepository: () => ({ read: async () => [original], save: async () => { legacyWrites++; } }),
} });
mock.module('../report-rewrite-repository', { namedExports: {
  rewriteRepository: () => ({
    read: async () => { if (failRead) throw new Error('storage unavailable'); return { current: null, submitted: null }; },
    save: async (_user: string, _month: string, input: object) => { writes++; if (failWrite) throw new ReflectionConflict('別の画面で更新'); return { ...input, revision: 1 }; },
  }),
} });
const legacy = await import('../../app/api/reports/[userId]/[month]/route');
const rewrite = await import('../../app/api/reports/[userId]/[month]/rewrite/route');
const origin = 'https://analyca.jp';
const url = `${origin}/api/reports/33833959932919231/2026-10`;
const context = { params: Promise.resolve({ userId: '33833959932919231', month: '2026-10' }) };
function request(body: unknown, source = origin): Request {
  return new Request(`${url}/rewrite`, { method: 'POST', headers: { origin: source }, body: JSON.stringify(body) });
}

test('古い画面からの上書きも拒否し、原文をそのまま返す', async () => {
  const before = JSON.stringify(original);
  assert.equal((await legacy.POST(request({ fields: { summary: '上書き' } }), context)).status, 409);
  assert.equal(legacyWrites, 0);
  assert.deepEqual((await (await legacy.GET(new Request(url), context)).json()).current, original);
  assert.equal(JSON.stringify(original), before);
});

test('途中の下書きのみ保存でき、入力不足の提出と別originを拒否する', async () => {
  const input = { expectedRevision: 0, requestId: randomUUID(), status: 'draft', report: emptyRewrite() };
  assert.equal((await rewrite.POST(request(input, 'https://other.example'), context)).status, 403);
  assert.equal((await rewrite.POST(request({ ...input, status: 'submitted' }), context)).status, 400);
  assert.equal(writes, 0);
  assert.equal((await rewrite.POST(request(input), context)).status, 200);
  assert.equal(writes, 1);
  assert.equal(legacyWrites, 0);
  failWrite = true;
  assert.equal((await rewrite.POST(request(input), context)).status, 409);
  failWrite = false;
});

test('対象外の月・アカウントと読み込み障害を区別する', async () => {
  for (const params of [{ userId: 'other', month: '2026-10' }, { userId: '33833959932919231', month: '2026-01' }]) {
    assert.equal((await rewrite.GET(new Request(url), { params: Promise.resolve(params) })).status, 404);
  }
  assert.deepEqual(await (await rewrite.GET(new Request(url), context)).json(), { current: null, submitted: null });
  failRead = true;
  const log = mock.method(console, 'error', () => {});
  try { assert.equal((await rewrite.GET(new Request(url), context)).status, 503); }
  finally { failRead = false; log.mock.restore(); }
});
