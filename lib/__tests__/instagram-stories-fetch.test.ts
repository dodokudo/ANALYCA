import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchActiveInstagramStories, extractStoryMetrics } from '../instagram-stories-fetch';

test('captures every page and keeps the story when insights are not yet available', async () => {
  const fetcher: typeof fetch = async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/stories')) return Response.json({ data: [{ id: '1' }], paging: { next: 'https://example.test/page2' } });
    if (url.pathname === '/page2') return Response.json({ data: [{ id: '2' }] });
    if (url.pathname === '/1/insights') return new Response('', { status: 400 });
    return Response.json({ data: [{ name: 'reach', values: [{ value: 0 }] }] });
  };
  const result = await fetchActiveInstagramStories('https://example.test', 'account', 'token', fetcher);
  assert.equal(result.stories.length, 2);
  assert.equal(result.metricsFailed, 1);
  assert.deepEqual(extractStoryMetrics(result.stories[0].insights), {});
  assert.deepEqual(extractStoryMetrics(result.stories[1].insights), { reach: 0 });
});

test('reports failed listing as an error, not a successful zero-story sync', async () => {
  await assert.rejects(fetchActiveInstagramStories('https://example.test', 'account', 'token', async () => new Response('', { status: 403 })), /list failed/);
});

test('successful empty listing is zero active stories', async () => {
  const result = await fetchActiveInstagramStories('https://example.test', 'account', 'token', async () => Response.json({ data: [] }));
  assert.deepEqual(result, { stories: [], metricsFailed: 0, apiErrors: [] });
});
