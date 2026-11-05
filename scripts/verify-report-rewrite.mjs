// Runs against unique, temporary verification tables only. Client reports are never written.
// node --import ./scripts/register-ts-tests.mjs scripts/verify-report-rewrite.mjs
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { BigQuery } from '@google-cloud/bigquery';
const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const { createRewriteRepository } = await import('../lib/report-rewrite-repository.ts');
const { emptyRewrite } = await import('../lib/report-rewrite.ts');
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID;
const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS || '{}');
const client = new BigQuery({ projectId, credentials, location: 'asia-northeast1' });
const prefix = `rewrite_verify_${randomUUID().replaceAll('-', '')}`;
const store = createRewriteRepository(client, projectId, prefix);
const originalUrl = 'https://analyca.jp/api/reports/33833959932919231/2026-10';
async function readOriginal() {
  const response = await fetch(originalUrl);
  assert.equal(response.status, 200);
  return response.json();
}
const original = await readOriginal();
try {
  await store.ensure();
  for (const suffix of ['revisions', 'lock']) await client.dataset('analyca').table(`${prefix}_${suffix}`).setMetadata({ expirationTime: String(Date.now() + 86400000) });
  assert.deepEqual(await store.read('verification-only', '2026-10'), { current: null, submitted: null });
  const draft = { expectedRevision: 0, requestId: randomUUID(), status: 'draft', report: emptyRewrite() };
  draft.report.summary = '検証用の下書き\n改行を保持';
  const saved = await store.save('verification-only', '2026-10', draft);
  assert.deepEqual(await store.read('verification-only', '2026-10'), { current: saved, submitted: null });
  assert.deepEqual(await store.save('verification-only', '2026-10', draft), saved);
  await assert.rejects(store.save('verification-only', '2026-10', { ...draft, requestId: randomUUID() }), /別の画面/);
  console.log('PASS: exact draft roundtrip, retry idempotency, stale write conflict');

  const report = emptyRewrite();
  report.monthly = {
    evaluation: '今月の成果と評価\n改行を保持',
    initiatives: [{ action: '投稿の改善', purpose: '読みやすくする', result: '検証で確認した結果', judgment: '継続する' }],
    findings: { positive: '良かった点', problem: '残った課題', cause: '未検証の仮説' },
    plans: [{ action: '来月やること', reason: 'そうする理由', check: '同じ集計条件で比較する' }],
    requests: '',
  };
  const submitted = await store.save('verification-only', '2026-10', { expectedRevision: 1, requestId: randomUUID(), status: 'submitted', report });
  const nextDraft = await store.save('verification-only', '2026-10', { expectedRevision: 2, requestId: randomUUID(), status: 'draft', report: { ...report, monthly: { ...report.monthly, evaluation: '次の下書き' } } });
  assert.deepEqual(await store.read('verification-only', '2026-10'), { current: nextDraft, submitted });
  assert.deepEqual(await store.read('verification-only', '2026-09'), { current: null, submitted: null });
  assert.deepEqual(await store.read('other-user', '2026-10'), { current: null, submitted: null });
  console.log('PASS: new draft preserves submitted version; month/account isolation');

  const racing = await Promise.allSettled(['A', 'B'].map(summary => store.save('verification-only', '2026-09', {
    expectedRevision: 0, requestId: randomUUID(), status: 'draft', report: { ...emptyRewrite(), summary },
  })));
  assert.equal(racing.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await store.read('verification-only', '2026-09')).current.revision, 1);
  assert.deepEqual(await readOriginal(), original);
  console.log('PASS: simultaneous first saves cannot overwrite; original report unchanged');
} finally {
  for (const suffix of ['revisions', 'lock']) await client.dataset('analyca').table(`${prefix}_${suffix}`).delete({ ignoreNotFound: true });
  console.log('Temporary verification tables removed; client reports untouched.');
}
