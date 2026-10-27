import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requireSuccessfulSyncs } from '../sync-results';

test('HTTP 200 with failed API sync cannot complete initial setup', async () => {
  await assert.rejects(requireSuccessfulSyncs([
    Promise.resolve(Response.json({ success: true })),
    Promise.resolve(Response.json({ success: false, error: 'reels: code 200' })),
  ]), /reels: code 200/);
});
test('waits for all jobs and reports HTTP, network and invalid response failures', async () => {
  let saved = false;
  await assert.rejects(requireSuccessfulSyncs([
    Promise.resolve(Response.json({ success: false }, { status: 500 })),
    Promise.reject(new Error('network failed')),
    Promise.resolve(new Response('invalid JSON')),
    new Promise<Response>(resolve => setTimeout(() => { saved = true; resolve(Response.json({ success: true })); }, 10)),
  ]), /HTTP 500.*network failed/);
  assert.equal(saved, true);
  await requireSuccessfulSyncs([Promise.resolve(Response.json({ success: true }))]);
});
