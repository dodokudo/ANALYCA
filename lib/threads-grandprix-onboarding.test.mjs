import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { GRANDPRIX_EVENTS } from './threads-grandprix-events.ts';
import { createGrandprixLoginSession, readGrandprixLoginSession } from './threads-grandprix-login-session.ts';

process.env.THREADS_APP_SECRET = 'test-only-secret';
const queries = [];
const emails = [];
let claim = true;
let fail = false;
mock.module('../app/threads-grandprix/grandprix-bigquery.ts', { namedExports: {
  projectId: 'test-project',
  getBigQueryClient: () => ({ query: async options => {
    queries.push(options);
    return [options.query.startsWith('SELECT id') && claim ? [{ id: 'entry-id' }] : []];
  } }),
} });
mock.module('./email.ts', { namedExports: { sendEmail: async (...args) => {
  emails.push(args);
  if (fail) throw new Error('fixture smtp failure');
} } });
const { sendGrandprixOnboardingEmail } = await import('./threads-grandprix-onboarding.ts');
const payload = { event: GRANDPRIX_EVENTS[0], username: 'example', email: 'fixture@example.test' };

test('new dashboard email contains a reusable event login URL and LINE invitation', async () => {
  await sendGrandprixOnboardingEmail(payload);
  assert.equal(emails.length, 1);
  assert.match(emails[0][2], /\/login\/threads\?grandprix=2026-autumn/);
  assert.match(emails[0][2], /https:\/\/line.me\/ti\/g\//);
  assert.doesNotMatch(emails[0][2], /grandprixEntry|access_token/);
  assert.match(queries[0].query, /NOT EXISTS[\s\S]*analyca.users/);
  assert.match(queries[0].query, /login_email_status = 'failed'/);
  assert.match(queries.at(-1).query, /login_email_status = 'sent'/);
});

test('already mailed or already created dashboard is not mailed again', async () => {
  claim = false;
  const before = emails.length;
  await sendGrandprixOnboardingEmail(payload);
  assert.equal(emails.length, before);
  claim = true;
});

test('SMTP failure is recorded for retry without rejecting entry completion', async () => {
  fail = true;
  await assert.doesNotReject(sendGrandprixOnboardingEmail(payload));
  assert.match(queries.at(-1).query, /login_email_status = 'failed'/);
  fail = false;
});

test('OAuth state is signed, expires, and does not contain an applicant identity', () => {
  const token = createGrandprixLoginSession('2026-autumn', 1000);
  assert.equal(readGrandprixLoginSession(token, 2000).eventId, '2026-autumn');
  assert.equal(readGrandprixLoginSession(token + 'x', 2000), null);
  assert.equal(readGrandprixLoginSession(token, 1000 + 2 * 60 * 60 * 1000), null);
  assert.equal(readGrandprixLoginSession(token, 2000).username, undefined);
});
