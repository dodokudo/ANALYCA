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

const autumnParticipant = { ...participant, eventIds: ['2026-autumn'] };

test('autumn preregistration does not open analytics before October 20 JST', () => {
  const now = new Date('2026-10-19T23:59:59.999+09:00');
  const access = evaluateThreadsGrandprixAccess(autumnParticipant, { now });
  assert.equal(access.allowed, false);
  assert.equal(access.state, 'not_started');
  assert.equal(access.actionType, undefined);
  assert.equal(isThreadsGrandprixPaymentRequired(autumnParticipant, now), false);
});

test('autumn entry opens analytics exactly at October 20 and through November 19 JST', () => {
  for (const timestamp of ['2026-10-20T00:00:00+09:00', '2026-11-19T23:59:59.999+09:00']) {
    const now = new Date(timestamp);
    const access = evaluateThreadsGrandprixAccess(autumnParticipant, { now });
    assert.equal(access.allowed, true);
    assert.equal(access.expiresAt, '2026-11-19T14:59:59.999Z');
    assert.equal(isThreadsGrandprixPaymentRequired(autumnParticipant, now), false);
  }
});

test('autumn free access ends at November 20 midnight JST', () => {
  const now = new Date('2026-11-20T00:00:00+09:00');
  const access = evaluateThreadsGrandprixAccess(autumnParticipant, { now });
  assert.equal(access.allowed, false);
  assert.equal(access.state, 'expired');
  assert.equal(access.actionType, 'reactivate');
  assert.equal(isThreadsGrandprixPaymentRequired(autumnParticipant, now), true);
});

test('summer-only entries and legacy callers do not gain autumn free access', () => {
  const now = new Date('2026-10-25T00:00:00+09:00');
  for (const subject of [participant, { ...participant, eventIds: ['2026-summer'] }, { ...participant, eventIds: ['unknown'] }]) {
    assert.equal(evaluateThreadsGrandprixAccess(subject, { now }).allowed, false);
    assert.equal(isThreadsGrandprixPaymentRequired(subject, now), true);
  }
  assert.equal(evaluateThreadsGrandprixAccess({ ...autumnParticipant, isParticipant: false }, { now }), null);
});

test('repeat entrants use autumn dates without changing the historical summer window', () => {
  const subject = { ...participant, eventIds: ['2026-summer', '2026-autumn'] };
  assert.equal(evaluateThreadsGrandprixAccess(subject, { now: new Date('2026-10-25T00:00:00+09:00') }).allowed, true);
  assert.equal(evaluateThreadsGrandprixAccess({ ...participant, eventIds: ['2026-summer'] }, { now: new Date('2026-07-31T23:59:59+09:00') }).allowed, true);
});

test('autumn promotion preserves existing subscription and payment-status rules', () => {
  const now = new Date('2026-10-25T00:00:00+09:00');
  for (const subscriptionStatus of ['current', 'active', 'trial', 'canceled', 'unpaid', 'suspended', 'expired']) {
    assert.equal(evaluateThreadsGrandprixAccess({ ...autumnParticipant, subscriptionStatus }, { now }), null);
    assert.equal(isThreadsGrandprixPaymentRequired({ ...autumnParticipant, subscriptionStatus }, now), false);
  }
});
