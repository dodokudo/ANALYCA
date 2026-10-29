import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

const writes: Array<{ query: string; params: Record<string, unknown> }> = [];
let failure: Error | null = null;
class FakeBigQuery {
  dataset() { return {}; }
  async createQueryJob(options: { query: string; params: Record<string, unknown> }) {
    writes.push(options);
    return [{ getQueryResults: async () => {
      if (failure) { const error = failure; failure = null; throw error; }
      return [[]];
    } }];
  }
}
mock.module('@google-cloud/bigquery', { namedExports: { BigQuery: FakeBigQuery } });
const { upsertInstagramInsightBatch } = await import('../bigquery');
const snapshot = { date: '2026-10-29', followers_count: 22497, posts_count: 348,
  reach: null, engagement: null, profile_views: null, website_clicks: null };

test('follower-only upsert preserves activity values and scopes writes to account and day', async () => {
  await upsertInstagramInsightBatch('yoko', [snapshot]);
  const write = writes.at(-1)!;
  assert.equal(write.params.user_id, 'yoko');
  assert.deepEqual(JSON.parse(String(write.params.rows)), [snapshot]);
  assert.match(write.query, /T.user_id = S.user_id AND T.date = S.date/);
  for (const field of ['followers_count', 'posts_count', 'reach', 'engagement', 'profile_views', 'website_clicks']) {
    assert.ok(write.query.includes(`${field} = COALESCE(S.${field}, T.${field})`));
  }
});

test('concurrent cron writes retry the completed failed job with the same idempotent payload', async () => {
  const before = writes.length;
  failure = new Error('Could not serialize access to table due to concurrent update');
  await upsertInstagramInsightBatch('yoko', [snapshot]);
  assert.equal(writes.length - before, 2);
  assert.deepEqual(writes.at(-1), writes.at(-2));
});

test('non-transient storage errors remain failures', async () => {
  const before = writes.length;
  failure = new Error('Access Denied');
  await assert.rejects(upsertInstagramInsightBatch('yoko', [snapshot]), /Access Denied/);
  assert.equal(writes.length - before, 1);
});
