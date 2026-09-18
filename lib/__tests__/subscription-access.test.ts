import assert from 'node:assert/strict';
import test from 'node:test';
import type { User } from '../bigquery';
import { evaluateDashboardAccess } from '../subscription-access';

function unpaidUser(paymentFailureCount: number): User {
  return {
    user_id: 'user-1',
    subscription_status: 'unpaid',
    payment_failure_count: paymentFailureCount,
  };
}

test('keeps dashboard access after the first failed payment', () => {
  const access = evaluateDashboardAccess(unpaidUser(1));

  assert.equal(access.allowed, true);
  assert.equal(access.state, 'allowed');
});

test('blocks dashboard access after the second failed payment', () => {
  const access = evaluateDashboardAccess(unpaidUser(2));

  assert.equal(access.allowed, false);
  assert.equal(access.state, 'payment_failed');
  assert.equal(access.actionType, 'payment_method');
});

test('allows dashboard access again after payment succeeds', () => {
  const access = evaluateDashboardAccess({
    ...unpaidUser(2),
    subscription_status: 'current',
  });

  assert.equal(access.allowed, true);
  assert.equal(access.state, 'allowed');
});
