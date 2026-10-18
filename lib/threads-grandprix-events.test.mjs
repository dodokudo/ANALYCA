import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GRANDPRIX_EVENTS, isGrandprixEntryOpen, grandprixRankingUrl } from './threads-grandprix-events.ts';
import { createGrandprixEntrySession, readGrandprixEntrySession } from './threads-grandprix-entry-session.ts';

process.env.THREADS_APP_SECRET = 'test-only-secret';
const autumn = GRANDPRIX_EVENTS.find(event => event.eventId === '2026-autumn');
const summer = GRANDPRIX_EVENTS.find(event => event.eventId === '2026-summer');

test('autumn accepts preregistration and closes exactly at midnight JST after November 19', () => {
  assert.equal(isGrandprixEntryOpen(autumn, new Date('2026-10-18T12:00:00+09:00')), true);
  assert.equal(isGrandprixEntryOpen(autumn, new Date('2026-11-19T23:59:59.999+09:00')), true);
  assert.equal(isGrandprixEntryOpen(autumn, new Date('2026-11-20T00:00:00+09:00')), false);
  assert.equal(isGrandprixEntryOpen(summer, new Date('2026-10-18T12:00:00+09:00')), false);
  assert.equal(grandprixRankingUrl(summer.eventId), '/threads-grandprix/ranking?event=2026-summer');
});

test('entry receipt is event-specific, expires and rejects tampering', () => {
  const now = Date.now();
  const receipt = createGrandprixEntrySession(autumn.eventId, 'example', now);
  assert.equal(readGrandprixEntrySession(receipt, now).eventId, autumn.eventId);
  assert.equal(readGrandprixEntrySession(receipt, now).username, 'example');
  assert.equal(readGrandprixEntrySession(receipt, now + 7_200_000), null);
  const [payload, signature] = receipt.split('.');
  const altered = JSON.parse(Buffer.from(payload, 'base64url').toString());
  altered.username = 'someone_else';
  assert.equal(readGrandprixEntrySession(`${Buffer.from(JSON.stringify(altered)).toString('base64url')}.${signature}`, now), null);
  assert.equal(readGrandprixEntrySession('bad'), null);
  assert.notEqual(receipt, createGrandprixEntrySession(autumn.eventId, 'example', now));
});
