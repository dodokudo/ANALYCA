import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateThreadsGrandprixAccess,
  isThreadsGrandprixPaymentRequired,
} from './threads-grandprix-access.ts';

const participant = {
  isParticipant: true,
  subscriptionStatus: 'none',
};

test('keeps uncontracted participants active through July 31 at 23:59 JST', () => {
  const now = new Date('2026-07-31T23:59:59.999+09:00');

  assert.equal(isThreadsGrandprixPaymentRequired(participant, now), false);
  assert.equal(evaluateThreadsGrandprixAccess(participant, { now })?.allowed, true);
});

test('requires payment from August 1 at 00:00 JST', () => {
  const now = new Date('2026-08-01T00:00:00+09:00');
  const access = evaluateThreadsGrandprixAccess(participant, { now });

  assert.equal(isThreadsGrandprixPaymentRequired(participant, now), true);
  assert.equal(access?.allowed, false);
  assert.equal(access?.actionType, 'reactivate');
});

test('does not restrict a contracted participant', () => {
  const access = evaluateThreadsGrandprixAccess({
    isParticipant: true,
    subscriptionStatus: 'current',
  }, {
    now: new Date('2026-08-01T00:00:00+09:00'),
  });

  assert.equal(access, null);
});

test('does not restrict a non-participant', () => {
  const access = evaluateThreadsGrandprixAccess({
    isParticipant: false,
    subscriptionStatus: 'none',
  }, {
    now: new Date('2026-08-01T00:00:00+09:00'),
  });

  assert.equal(access, null);
});

test('admin access bypasses the participant restriction', () => {
  const access = evaluateThreadsGrandprixAccess(participant, {
    now: new Date('2026-08-01T00:00:00+09:00'),
    isAdmin: true,
  });

  assert.equal(access, null);
});
