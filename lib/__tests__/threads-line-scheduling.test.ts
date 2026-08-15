import assert from 'node:assert/strict';
import test from 'node:test';
import { validateThreadsScheduleSlotAvailability } from '../threadsLineScheduling';

test('同一時刻に別投稿がある場合は予約を拒否する', () => {
  assert.equal(
    validateThreadsScheduleSlotAvailability({ exactTimeCount: 1, sameDayCount: 1 }),
    '同じ日時に別の投稿が予約されています。別の日時を選択してください。',
  );
});

test('同じ日に2件ある場合は3件目を拒否する', () => {
  assert.equal(
    validateThreadsScheduleSlotAvailability({ exactTimeCount: 0, sameDayCount: 2 }),
    'この日はすでに2件の投稿があります。別の日を選択してください。',
  );
});

test('同じ日に1件だけなら2件目を許可する', () => {
  assert.equal(
    validateThreadsScheduleSlotAvailability({ exactTimeCount: 0, sameDayCount: 1 }),
    undefined,
  );
});
