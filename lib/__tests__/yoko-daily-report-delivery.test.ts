import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deliverDailyReport, type DailyDelivery } from '../yoko-daily-report-delivery';

function fixture(failure?: 'validate' | 'send') {
  let record: DailyDelivery | null = null;
  const calls: boolean[] = [];
  const store = {
    ensure: async () => {},
    claim: async () => { if (record) return false; record = { jobId: 'one', state: 'sending', lineMessageId: null }; return true; },
    read: async () => record,
    finish: async (_group: string, _date: string, id: string | null) => { record = { jobId: 'one', state: id ? 'sent' : 'unconfirmed', lineMessageId: id }; },
  };
  const request = async (_destination: { id: string; name: string }, _date: string, _message: Record<string, unknown>, validate: boolean) => {
    calls.push(validate);
    if (failure === (validate ? 'validate' : 'send')) throw new Error('simulated failure');
    return { groupName: 'test', messageId: validate ? null : 'message-1' };
  };
  return { store, request, calls };
}
const destination = { id: 'test', name: 'test' };

test('同時実行・再実行でも同じ日に送信するのは1回だけ', async () => {
  const deps = fixture();
  const results = await Promise.all([deliverDailyReport(destination, '2026-11-04', {}, deps), deliverDailyReport(destination, '2026-11-04', {}, deps)]);
  assert.equal(results.filter(result => result.sent).length, 1);
  assert.equal(deps.calls.filter(validate => !validate).length, 1);
  const again = await deliverDailyReport(destination, '2026-11-04', {}, deps);
  assert.equal(again.sent, false);
  assert.equal(again.delivery?.lineMessageId, 'message-1');
  assert.equal(deps.calls.filter(validate => !validate).length, 1);
});

test('送信結果が不明なときは、送信記録を保持し自動で再送しない', async () => {
  const deps = fixture('send');
  await assert.rejects(deliverDailyReport(destination, '2026-11-04', {}, deps), /failure/);
  const again = await deliverDailyReport(destination, '2026-11-04', {}, deps);
  assert.equal(again.delivery?.state, 'unconfirmed');
  assert.deepEqual(deps.calls, [true, false]);
});

test('形式・送信先の検証に失敗したら送信せず、送信枠も確保しない', async () => {
  const deps = fixture('validate');
  await assert.rejects(deliverDailyReport(destination, '2026-11-04', {}, deps), /failure/);
  assert.equal(await deps.store.read(), null);
  assert.deepEqual(deps.calls, [true]);
});
