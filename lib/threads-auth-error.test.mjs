import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isThreadsAuthError, THREADS_REAUTH_MESSAGE } from './threads-auth-error.ts';

test('detects Meta token errors from routes and saved worker failures', () => {
  const payload = { error: { code: 190, message: 'Error validating access token: The session has been invalidated because the user changed their password' } };
  for (const input of [payload, JSON.stringify(payload), new Error(`Failed to get Threads account info: ${JSON.stringify(payload)}`), `Main: ${JSON.stringify(payload)}`, THREADS_REAUTH_MESSAGE]) {
    assert.equal(isThreadsAuthError(input), true);
  }
});
test('does not send users to login for network, permission or rate limit failures', () => {
  for (const input of [null, undefined, '', 'Failed to fetch', { error: { code: 10, message: 'Permission denied' } }, { error: { code: 4, message: 'Rate limit' } }, 'Upload failed (190 bytes)', '{broken JSON']) {
    assert.equal(isThreadsAuthError(input), false);
  }
});
