import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getMonthlyEquivalentPrice,
  getPlanIdForBillingCycle,
  getUnivaPaySubscriptionPeriod,
  PLANS,
} from './plans.ts';

test('maps ANALYCA billing cycles to UnivaPay periods', () => {
  assert.equal(getUnivaPaySubscriptionPeriod('standard'), 'monthly');
  assert.equal(getUnivaPaySubscriptionPeriod('standard-yearly'), 'annually');
});

test('keeps approved yearly prices and monthly equivalents', () => {
  assert.equal(PLANS['light-threads-yearly'].price, 47_760);
  assert.equal(getMonthlyEquivalentPrice('light-threads-yearly'), 3_980);
  assert.equal(PLANS['standard-yearly'].price, 94_080);
  assert.equal(getMonthlyEquivalentPrice('standard-yearly'), 7_840);
  assert.equal(PLANS['pro-yearly'].price, 182_400);
  assert.equal(getMonthlyEquivalentPrice('pro-yearly'), 15_200);
});

test('builds monthly and yearly plan ids', () => {
  assert.equal(getPlanIdForBillingCycle('light-threads', 'monthly'), 'light-threads');
  assert.equal(getPlanIdForBillingCycle('light-threads', 'yearly'), 'light-threads-yearly');
});
