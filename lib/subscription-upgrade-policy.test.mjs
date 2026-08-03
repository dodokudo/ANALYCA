import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateProratedUpgradeQuote } from './subscription-upgrade-policy.ts';

test('prorates a monthly upgrade by remaining calendar days in Japan', () => {
  const quote = calculateProratedUpgradeQuote({
    currentPrice: 4980,
    targetPrice: 9800,
    billingCycle: 'monthly',
    nextBillingDate: '2026-08-31',
    now: new Date('2026-08-03T08:14:48.000Z'),
  });

  assert.deepEqual(quote, {
    proratedAmount: 4354,
    fullDifference: 4820,
    periodStart: '2026-07-31',
    periodEnd: '2026-08-31',
    remainingDays: 28,
    totalDays: 31,
  });
});

test('charges the full difference when upgrading on the billing-cycle start date', () => {
  const quote = calculateProratedUpgradeQuote({
    currentPrice: 4980,
    targetPrice: 9800,
    billingCycle: 'monthly',
    nextBillingDate: '2026-08-31',
    now: new Date('2026-07-31T03:00:00.000Z'),
  });

  assert.equal(quote.proratedAmount, 4820);
  assert.equal(quote.remainingDays, 31);
});

test('handles month-end billing cycles', () => {
  const quote = calculateProratedUpgradeQuote({
    currentPrice: 4980,
    targetPrice: 9800,
    billingCycle: 'monthly',
    nextBillingDate: '2026-03-31',
    now: new Date('2026-03-01T00:00:00.000Z'),
  });

  assert.equal(quote.periodStart, '2026-02-28');
  assert.equal(quote.totalDays, 31);
  assert.equal(quote.remainingDays, 30);
});

test('prorates annual upgrades by remaining days', () => {
  const quote = calculateProratedUpgradeQuote({
    currentPrice: 47760,
    targetPrice: 94080,
    billingCycle: 'yearly',
    nextBillingDate: '2027-08-31',
    now: new Date('2026-08-31T00:00:00.000Z'),
  });

  assert.equal(quote.proratedAmount, 46320);
  assert.equal(quote.totalDays, 365);
  assert.equal(quote.remainingDays, 365);
});
