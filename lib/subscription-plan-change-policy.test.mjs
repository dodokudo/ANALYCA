import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canActivatePendingPlanChange,
  PLAN_CHANGE_INITIAL_AMOUNT,
} from './subscription-plan-change-policy.ts';

test('does not charge an initial amount when scheduling a plan change', () => {
  assert.equal(PLAN_CHANGE_INITIAL_AMOUNT, 0);
});

test('activates a pending plan only on or after its effective date', () => {
  const effectiveAt = new Date('2026-07-27T00:00:00.000Z');

  assert.equal(
    canActivatePendingPlanChange(effectiveAt, new Date('2026-07-26T23:59:59.999Z')),
    false,
  );
  assert.equal(
    canActivatePendingPlanChange(effectiveAt, new Date('2026-07-27T00:00:00.000Z')),
    true,
  );
  assert.equal(canActivatePendingPlanChange(null, new Date('2026-07-27T00:00:00.000Z')), false);
});
