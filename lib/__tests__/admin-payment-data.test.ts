import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import type { UnivaPayCharge, UnivaPayListResponse } from '../univapay/client';

const starts: number[] = [];
let active = 0;
let peak = 0;
let chargeReads = 0;
let failRefund = false;
const charges = Array.from({ length: 5 }, (_, i) => ({
  id: String(i), subscription_id: 'sub', mode: 'live', status: 'successful',
  charged_amount: 4980, charged_currency: 'JPY', created_on: '2026-09-01T00:00:00Z',
} as UnivaPayCharge));

mock.module('../univapay/client', { namedExports: {
  collectUnivaPayPages: async (read: () => Promise<UnivaPayListResponse<unknown>>) => (await read()).items,
  listCharges: async () => { chargeReads++; return { items: charges, has_more: false }; },
  listChargeRefunds: async () => {
    starts.push(Date.now());
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 1100));
    active--;
    if (failRefund) throw new Error('simulated refund read failure');
    return { items: [], has_more: false };
  },
} });
const { getAdminPaymentData } = await import('../admin-payment-data');

test('重複読み込みをまとめ、返金取得の間隔と同時実行数を守る', async () => {
  const users = [{ user_id: 'one', subscription_id: 'sub' }];
  const [first, second] = await Promise.all([getAdminPaymentData(users, []), getAdminPaymentData(users, [])]);
  assert.equal(chargeReads, 1);
  assert.equal(starts.length, 5);
  assert.ok(peak > 1 && peak <= 3);
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= 475);
  assert.equal(first.users.one.netPaid, 24900);
  assert.deepEqual(first, second);
  await getAdminPaymentData(users, []);
  assert.equal(chargeReads, 1);
});

test('返金取得失敗は確定額としてキャッシュせず、再取得できる', async () => {
  const users = [{ user_id: 'two', subscription_id: 'sub' }];
  failRefund = true;
  const failed = await getAdminPaymentData(users, []);
  assert.equal(failed.users.two.netPaid, null);
  failRefund = false;
  const recovered = await getAdminPaymentData(users, []);
  assert.equal(recovered.users.two.netPaid, 24900);
  assert.equal(recovered.users.two.refundsComplete, true);
  assert.equal(chargeReads, 3);
});
