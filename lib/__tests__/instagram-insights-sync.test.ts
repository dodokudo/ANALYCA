import assert from 'node:assert/strict';
import { test } from 'node:test';
import { instagramInsightDates, syncAccountInsightDays, type InstagramAccountSnapshot } from '../instagram-insights-sync';

const now = new Date('2026-10-27T09:00:00Z');
const names = ['reach', 'profile_views', 'website_clicks', 'accounts_engaged'];

test('uses JST and bounds a long outage to current and previous month', () => {
  const days = instagramInsightDates(now);
  assert.equal(days[0], '2026-10-27');
  assert.equal(days.at(-1), '2026-09-01');
  assert.equal(days.length, 57);
  assert.equal(instagramInsightDates(new Date('2026-09-30T16:00:00Z'))[0], '2026-10-01');
});

test('saves recent batches first, uses explicit day windows, and never invents historical followers', async () => {
  const batches: InstagramAccountSnapshot[][] = [];
  let calls = 0;
  const fetcher: typeof fetch = async input => {
    const url = new URL(String(input));
    calls++;
    assert.equal(url.searchParams.get('metric_type'), 'total_value');
    const since = Number(url.searchParams.get('since')) * 1000;
    const until = Number(url.searchParams.get('until')) * 1000;
    assert.ok(until - since <= 86400000);
    assert.ok(until <= now.getTime());
    assert.equal(new Date(since).getUTCHours(), 15);
    if (calls > 7) assert.ok(batches.length > 0, 'latest days must already be saved');
    return Response.json({ data: names.map(name => ({ name, total_value: { value: 0 } })) });
  };
  const result = await syncAccountInsightDays({ now, graphBase: 'https://example.test', accountId: 'id', accessToken: 'test', followers: 123, posts: 10, fetcher, save: async rows => { batches.push(rows); } });
  assert.equal(result.success, true);
  assert.equal(result.savedDays, 57);
  assert.equal(batches.length, 9);
  assert.equal(batches[0][0].date, '2026-10-27');
  assert.equal(batches[0][0].followers_count, 123);
  assert.equal(batches[0][1].followers_count, null);
  assert.equal(batches[0][1].posts_count, null);
  assert.equal(batches[0][0].reach, 0);
});

test('failed or missing metrics do not overwrite records with zeros', async () => {
  const saved: InstagramAccountSnapshot[] = [];
  const fetcher: typeof fetch = async input => {
    const since = new Date(Number(new URL(String(input)).searchParams.get('since')) * 1000).toISOString();
    if (since.startsWith('2026-10-26')) return new Response('', { status: 403 });
    const metrics = since.startsWith('2026-10-25') ? names.slice(0, 1) : names;
    return Response.json({ data: metrics.map(name => ({ name, total_value: { value: 1 } })) });
  };
  const result = await syncAccountInsightDays({ now, graphBase: 'https://example.test', accountId: 'id', accessToken: 'test', followers: 123, posts: 10, fetcher, save: async rows => { saved.push(...rows); } });
  assert.equal(result.success, false);
  assert.deepEqual(result.failedDates.sort(), ['2026-10-26', '2026-10-27']);
  assert.equal(saved.length, 55);
  assert.ok(saved.every(row => row.date < '2026-10-26'));
});
