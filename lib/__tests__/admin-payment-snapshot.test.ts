import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BigQuery } from '@google-cloud/bigquery';
import { createAdminPaymentSnapshotStore } from '../admin-payment-snapshot';
import type { AdminPaymentData } from '../admin-payment-data';

function fixture() {
  const rows: Array<{ id: string; fetchedAt: string; payload: string }> = [];
  let writes = 0;
  let failInsert = false;
  const client = {
    async createQueryJob({ query, params }: { query: string; params?: Record<string, string> }) {
      writes++;
      return [{ getQueryResults: async () => {
        if (query.startsWith('INSERT')) {
          if (failInsert) throw new Error('database write failed');
          rows.push({ id: params!.id, fetchedAt: params!.fetchedAt, payload: params!.payload });
        }
        return [[]];
      } }];
    },
    async query({ params }: { params?: Record<string, string> }) {
      return [params?.id ? rows.filter(row => row.id === params.id)
        : [...rows].sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt)).slice(0, 1)];
    },
  } as unknown as BigQuery;
  return { client, get writes() { return writes; }, set failInsert(value: boolean) { failInsert = value; } };
}
function snapshot(fetchedAt = '2026-10-04T00:00:00.000Z'): AdminPaymentData {
  return { fetchedAt, error: null, users: { one: {
    totalPaid: 9800, totalRefunded: 0, netPaid: 9800, paymentCount: 1, paidMonths: 1,
    firstPaidAt: fetchedAt, lastPaidAt: fetchedAt, lastPaidAmount: 9800, refundsComplete: true,
  } } };
}

test('保存した決済情報は別インスタンスでも読み出せ、画面用の読み取りでは書き込みをしない', async () => {
  const db = fixture();
  const first = createAdminPaymentSnapshotStore(db.client, 'test-project');
  assert.equal(await first.read(), null);
  assert.equal(db.writes, 0);
  await first.save(snapshot());
  const before = db.writes;
  const second = createAdminPaymentSnapshotStore(db.client, 'test-project');
  assert.deepEqual(await second.read(), snapshot());
  assert.equal(db.writes, before);
});

test('不完全な集計や保存失敗で前回の確定データを消さない', async () => {
  const db = fixture();
  const store = createAdminPaymentSnapshotStore(db.client, 'test-project');
  await store.save(snapshot());
  const incomplete = snapshot();
  incomplete.users.one.refundsComplete = false;
  incomplete.users.one.netPaid = null;
  await assert.rejects(store.save(incomplete), /Incomplete/);
  db.failInsert = true;
  await assert.rejects(store.save(snapshot('2026-10-04T00:15:00.000Z')), /database write failed/);
  assert.deepEqual(await store.read(), snapshot());
});

test('古い同期が後から完了しても最新の集計を巻き戻さない', async () => {
  const db = fixture();
  const store = createAdminPaymentSnapshotStore(db.client, 'test-project');
  const newer = snapshot('2026-10-04T00:15:00.000Z');
  await store.save(newer);
  await store.save(snapshot());
  assert.deepEqual(await store.read(), newer);
});
