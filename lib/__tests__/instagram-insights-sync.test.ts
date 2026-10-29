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
  assert.equal(batches.length, 10);
  assert.equal(batches[0][0].date, '2026-10-27');
  assert.equal(batches[0][0].followers_count, 123);
  assert.equal(batches[0][0].reach, null);
  assert.equal(batches[1][1].followers_count, null);
  assert.equal(batches[1][1].posts_count, null);
  assert.equal(batches[1][0].reach, 0);
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
  assert.equal(saved.length, 56);
  assert.equal(saved[0].followers_count, 123);
  assert.equal(saved[0].reach, null);
  assert.ok(saved.slice(1).every(row => row.date < '2026-10-26'));
});

test('thisWeek fetches only Sunday through today and preserves follow breakdown and additional metrics', async () => {
  const saved: InstagramAccountSnapshot[] = [];
  const fetcher: typeof fetch = async input => {
    const url = new URL(String(input));
    if (url.searchParams.get('metric') === 'follows_and_unfollows') {
      return Response.json({ data: [{ name: 'follows_and_unfollows', total_value: { breakdowns: [{
        dimension_keys: ['follow_type'], results: [
          { dimension_values: ['FOLLOWER'], value: 7 }, { dimension_values: ['NON_FOLLOWER'], value: 3 },
        ],
      }] } }] });
    }
    return Response.json({ data: [...names, 'views', 'likes', 'saves', 'shares', 'comments', 'total_interactions'].map(name => ({ name, total_value: { value: 11 } })) });
  };
  const result = await syncAccountInsightDays({ range: 'thisWeek', now, graphBase: 'https://example.test', accountId: 'id', accessToken: 'test', followers: 123, posts: 10, fetcher, save: async rows => { saved.push(...rows); } });
  assert.equal(result.savedDays, 3);
  assert.deepEqual(saved.slice(1).map(row => row.date), ['2026-10-27', '2026-10-26', '2026-10-25']);
  assert.equal(saved[1].follows, 7);
  assert.equal(saved[1].unfollows, 3);
  assert.equal(saved[1].views, 11);
  assert.equal(saved[1].saves, 11);
});

test('saves current followers before fetching empty current-day insights', async () => {
  const saved: InstagramAccountSnapshot[] = [];
  const fetcher: typeof fetch = async input => {
    assert.equal(saved[0].followers_count, 22497);
    const url = new URL(String(input));
    const since = Number(url.searchParams.get('since'));
    if (since === Date.parse('2026-10-29T00:00:00+09:00') / 1000) return Response.json({ data: [] });
    return Response.json({ data: names.map(name => ({ name, total_value: { value: 1 } })) });
  };
  const result = await syncAccountInsightDays({ range: 'thisWeek', now: new Date('2026-10-28T15:00:03Z'), graphBase: 'https://example.test', accountId: 'id', accessToken: 'test', followers: 22497, posts: 348, fetcher, save: async rows => { saved.push(...rows); } });
  assert.equal(result.success, true);
  assert.equal(result.accountSnapshotSaved, true);
  assert.deepEqual(result.pendingDates, ['2026-10-29']);
  assert.equal(saved[0].date, '2026-10-29');
  assert.equal(saved[0].reach, null);
  assert.ok(saved.filter(row => row.date < '2026-10-29').every(row => row.followers_count === null));
});

test('at exact JST midnight the account snapshot is saved even without an insight window', async () => {
  const saved: InstagramAccountSnapshot[] = [];
  const result = await syncAccountInsightDays({ range: 'thisWeek', now: new Date('2026-10-31T15:00:00Z'), graphBase: 'https://example.test', accountId: 'id', accessToken: 'test', followers: 0, posts: 0,
    fetcher: async () => { throw new Error('No activity window exists yet'); }, save: async rows => { saved.push(...rows); } });
  assert.equal(result.accountSnapshotSaved, true);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].date, '2026-11-01');
  assert.equal(saved[0].followers_count, 0);
});
