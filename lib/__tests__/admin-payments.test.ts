import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aggregateAdminPayments } from '../admin-payments';
import { collectUnivaPayPages, type UnivaPayCharge, type UnivaPaySubscription, type UnivaPayRefund } from '../univapay/client';

const users = [{ user_id: 'one', subscription_id: 'sub-new' }, { user_id: 'two', subscription_id: null }];
const subscription = (id = 'sub-new', extra: Partial<UnivaPaySubscription> = {}): UnivaPaySubscription => ({
  id, store_id: 'store', transaction_token_id: 'token', amount: 4980, currency: 'JPY', period: 'monthly',
  status: 'current', mode: 'live', created_on: '2026-01-01T00:00:00Z', metadata: { analycaUserId: 'one' }, ...extra,
});
const charge = (id: string, date: string, extra: Partial<UnivaPayCharge> = {}): UnivaPayCharge => ({
  id, store_id: 'store', transaction_token_id: 'token', subscription_id: 'sub-new', requested_amount: 4980,
  requested_currency: 'JPY', charged_amount: 4980, charged_currency: 'JPY', status: 'successful', mode: 'live', created_on: date, ...extra,
});
const refund = (id: string, amount: number, status: UnivaPayRefund['status'] = 'successful'): UnivaPayRefund => ({
  id, charge_id: 'a', amount, currency: 'JPY', status, mode: 'live',
});
const run = (charges: UnivaPayCharge[], subs = [subscription()], refunds: Record<string, UnivaPayRefund[] | null> = Object.fromEntries(charges.map(c => [c.id, []]))) =>
  aggregateAdminPayments(users, subs, charges, refunds);

test('全期間の成功した実決済だけを集計し、初回・前回・前回額を出す', () => {
  const charges = [charge('a', '2025-07-01T00:00:00Z'), charge('b', '2026-09-01T00:00:00Z', { charged_amount: 9800 }),
    charge('failed', '2026-10-01T00:00:00Z', { status: 'failed' }), charge('test', '2026-10-01T00:00:00Z', { mode: 'test' }),
    charge('live-test', '2026-10-01T00:00:00Z', { metadata: { planId: 'test-100' } }),
    charge('pending', '2026-10-01T00:00:00Z', { status: 'pending' })];
  const result = run(charges).one;
  assert.equal(result.netPaid, 14780); assert.equal(result.paymentCount, 2);
  assert.equal(result.firstPaidAt, charges[0].created_on); assert.equal(result.lastPaidAt, charges[1].created_on);
  assert.equal(result.lastPaidAmount, 9800); assert.equal(result.paidMonths, 2);
});

test('契約を移管したときは現在の所有者へ集約し、過去のmetadataへ二重計上しない', () => {
  const result = run([charge('a', '2026-09-01T00:00:00Z', { metadata: { analycaUserId: 'two' } })],
    [subscription('sub-new', { metadata: { analycaUserId: 'two' } })]);
  assert.equal(result.one.netPaid, 4980); assert.equal(result.two.netPaid, 0);
});

test('プラン変更前の契約も含め、同じ月の追加決済は継続月数へ二重計上しない', () => {
  const a = charge('a', '2026-08-01T00:00:00Z', { subscription_id: 'sub-old' });
  const b = charge('b', '2026-08-12T00:00:00Z', { charged_amount: 4820 });
  const result = run([a, b, b], [subscription(), subscription('sub-old')]).one;
  assert.equal(result.netPaid, 9800); assert.equal(result.paymentCount, 2); assert.equal(result.paidMonths, 1);
});

test('日本時間の月を使い、支払いのない月を数えない', () => {
  const result = run([charge('a', '2026-06-30T15:00:00Z'), charge('b', '2026-07-15T00:00:00Z'), charge('c', '2026-09-01T00:00:00Z')]).one;
  assert.equal(result.paidMonths, 2);
});

test('成功返金だけを差し引き、全額返金の月を除外する', () => {
  const charges = [charge('a', '2026-08-01T00:00:00Z'), charge('b', '2026-09-01T00:00:00Z')];
  const result = run(charges, [subscription()], { a: [refund('r1', 4980), refund('r1', 4980)], b: [refund('r2', 1000), refund('r3', 200, 'failed')] }).one;
  assert.equal(result.netPaid, 3980); assert.equal(result.totalRefunded, 5980); assert.equal(result.paidMonths, 1);
});

test('返金取得失敗をゼロ返金とみなさず、累計と継続月数を未確定にする', () => {
  const result = run([charge('a', '2026-09-01T00:00:00Z')], [subscription()], { a: null }).one;
  assert.equal(result.netPaid, null); assert.equal(result.paidMonths, null); assert.equal(result.refundsComplete, false);
  assert.equal(result.lastPaidAmount, 4980);
});

test('年払いは12ヶ月分、オプション・単発は金額にのみ含める', () => {
  const result = run([charge('year', '2026-01-01T00:00:00Z'),
    charge('option', '2027-03-01T00:00:00Z', { subscription_id: 'option' }),
    charge('once', '2027-05-01T00:00:00Z', { subscription_id: null, metadata: { analycaUserId: 'one' } })],
  [subscription('sub-new', { period: 'annually' }), subscription('option', { metadata: { analycaUserId: 'one', optionCode: 'link-line' } })]).one;
  assert.equal(result.paidMonths, 12); assert.equal(result.netPaid, 14940);
});

test('別サービスの決済や通貨違いを黙って合算しない', () => {
  assert.equal(run([charge('a', '2026-09-01T00:00:00Z', { subscription_id: 'other' })]).one.netPaid, 0);
  assert.throws(() => run([charge('a', '2026-09-01T00:00:00Z', { charged_currency: 'USD' })]), /決済金額/);
});

test('全ページ取得・重複排除・次cursorの引き継ぎ', async () => {
  const cursors: Array<string | undefined> = [];
  const result = await collectUnivaPayPages(async cursor => {
    cursors.push(cursor);
    return cursor ? { items: [{ id: 'b' }, { id: 'c' }], has_more: false }
      : { items: [{ id: 'a' }, { id: 'b' }], has_more: true, next_cursor: 'next' };
  });
  assert.deepEqual(result.map(item => item.id), ['a', 'b', 'c']); assert.deepEqual(cursors, [undefined, 'next']);
});

test('途中ページの失敗・cursorループでは途中までの額を返さない', async () => {
  await assert.rejects(collectUnivaPayPages(async cursor => {
    if (cursor) throw new Error('network');
    return { items: [{ id: 'a' }], has_more: true };
  }), /network/);
  await assert.rejects(collectUnivaPayPages(async () => ({ items: [{ id: 'a' }], has_more: true, next_cursor: 'loop' })), /最後まで/);
});
