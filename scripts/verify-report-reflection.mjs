// Explicit opt-in: creates and deletes only two uniquely named verification tables.
// node --import ./scripts/register-ts-tests.mjs scripts/verify-report-reflection.mjs
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { BigQuery } from '@google-cloud/bigquery';
const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const { createReflectionRepository } = await import('../lib/report-reflection-repository.ts');
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID;
const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS || '{}');
const client = new BigQuery({ projectId, credentials, location: 'asia-northeast1' });
const prefix = `reflection_verify_${randomUUID().replaceAll('-', '')}`;
const store = createReflectionRepository(client, projectId, prefix);
const fields = { summary: '保存確認\n改行も保持', results: '成果', improvements: '', nextMonth: '次月' };
try {
  await store.ensure();
  const first = { expectedRevision: 0, requestId: randomUUID(), fields };
  const written = await store.save('verification-only', '2026-09', first);
  assert.deepEqual(written.fields, fields);
  assert.deepEqual((await store.read('verification-only', '2026-09'))[0], written);
  console.log('PASS: database save and fresh read preserve exact text');
  assert.deepEqual(await store.save('verification-only', '2026-09', first), written);
  assert.equal((await store.read('verification-only', '2026-09', 50)).length, 1);
  console.log('PASS: lost-response retry does not duplicate or overwrite');
  await assert.rejects(store.save('verification-only', '2026-09', { ...first, requestId: randomUUID() }), /別の画面/);
  await store.save('verification-only', '2026-08', { ...first, requestId: randomUUID(), fields: { ...fields, summary: '8月' } });
  assert.equal((await store.read('verification-only', '2026-09'))[0].fields.summary, fields.summary);
  assert.equal((await store.read('verification-only', '2026-08'))[0].fields.summary, '8月');
  console.log('PASS: stale updates rejected and months isolated');
  const racing = await Promise.allSettled(['A', 'B'].map(summary => store.save('verification-only', '2026-10', {
    expectedRevision: 0, requestId: randomUUID(), fields: { ...fields, summary },
  })));
  assert.equal(racing.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await store.read('verification-only', '2026-10', 50)).length, 1);
  console.log('PASS: concurrent first saves cannot both overwrite the same month');
} finally {
  for (const suffix of ['revisions', 'lock']) await client.dataset('analyca').table(`${prefix}_${suffix}`).delete({ ignoreNotFound: true });
  console.log('Verification tables removed; client reports were not modified.');
}
