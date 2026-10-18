import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === 'next/server' ? 'next/server.js' : specifier, context);
} });
let eventIds = ['2026-autumn'];
let paymentMutations = 0;
const unexpectedMutation = async () => { paymentMutations++; throw new Error('Unexpected payment mutation'); };
mock.module('./bigquery.ts', { namedExports: {
  getUserById: async () => ({ user_id: 'fixture', threads_username: 'example', subscription_status: 'none', recurring_token_id: 'saved-token' }),
  getThreadsGrandprixEventIds: async () => eventIds,
  updateUserSubscription: unexpectedMutation,
} });
mock.module('./univapay/client.ts', { namedExports: {
  createSubscriptionFromToken: unexpectedMutation, updateSubscription: unexpectedMutation, getSubscription: unexpectedMutation,
} });
mock.module('./line-harness-sync.ts', { namedExports: { syncAnalycaUserRecordToLineHarness: unexpectedMutation } });
const { POST } = await import('../app/api/subscription/reactivate/route.ts');
const request = () => new Request('https://example.test/reactivate', { method: 'POST', body: JSON.stringify({ userId: 'fixture' }) });

test('autumn free access never starts a subscription even when a saved payment token exists', async () => {
  mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-25T00:00:00+09:00') });
  try {
    const response = await POST(request());
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /2026\/11\/19/);
    assert.equal(paymentMutations, 0);
  } finally { mock.timers.reset(); }
});

test('preregistration returns the opening date without a payment side effect', async () => {
  mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-19T00:00:00+09:00') });
  try {
    const response = await POST(request());
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /10月20日/);
    assert.equal(paymentMutations, 0);
  } finally { mock.timers.reset(); }
});

test('after autumn, user must explicitly provide payment details; there is no automatic renewal', async () => {
  mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-20T00:00:00+09:00') });
  try {
    const response = await POST(request());
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.requiresPaymentMethod, true);
    assert.match(body.checkoutUrl, /trial=0/);
    assert.equal(paymentMutations, 0);
  } finally { mock.timers.reset(); }
});

test('summer-only entrants still require payment during autumn', async () => {
  mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-25T00:00:00+09:00') });
  eventIds = ['2026-summer'];
  try {
    const response = await POST(request());
    assert.equal((await response.json()).requiresPaymentMethod, true);
    assert.equal(paymentMutations, 0);
  } finally { mock.timers.reset(); eventIds = ['2026-autumn']; }
});
