import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

const authError = JSON.stringify({ error: { code: 190, message: 'Error validating access token' } });
const { getThreadsConnectionStatus } = await import('../threads-connection-status');

test('re-login clears auth failures while network errors remain unknown', async () => {
  let apiStatus = 200;
  let apiBody: unknown = { id: 'threads-user' };
  let offline = false;
  let calls = 0;
  const stub = mock.method(globalThis, 'fetch', async (url: string | URL | Request, options?: RequestInit) => {
    calls++;
    assert.equal(String(url), 'https://graph.threads.net/v1.0/me?fields=id');
    assert.equal(options?.cache, 'no-store');
    assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer saved-credential');
    if (offline) throw new Error('Network unavailable');
    return Response.json(apiBody, { status: apiStatus });
  });
  let token: string | null = 'saved-credential';
  const read = () => getThreadsConnectionStatus(token);
  try {
    // A saved credential is only considered restored after a successful API call.
    assert.equal(await read(), 'connected');
    apiStatus = 400;
    apiBody = JSON.parse(authError);
    assert.equal(await read(), 'reauth_required');
    apiStatus = 429;
    apiBody = { error: { code: 4, message: 'Rate limit' } };
    assert.equal(await read(), 'unknown');
    offline = true;
    assert.equal(await read(), 'unknown');
    offline = false;
    token = null;
    const callsBeforeMissingToken = calls;
    assert.equal(await read(), 'reauth_required');
    assert.equal(calls, callsBeforeMissingToken);
    token = 'saved-credential';
    apiStatus = 200;
    apiBody = { id: 'threads-user' };
    assert.equal(await read(), 'connected');
  } finally {
    stub.mock.restore();
  }
});
