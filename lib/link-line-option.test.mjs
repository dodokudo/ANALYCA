import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generateShortLinkCode,
  optionHasAccess,
  resolveShortLinkCode,
  userHasLinkLineOptionAccess,
  validateShortLinkInput,
} from './link-line-option.ts';

const NOW = new Date('2026-07-28T00:00:00.000Z');

function option(status, expiresAt = null) {
  return {
    userId: 'user-1',
    subscriptionId: 'subscription-1',
    status,
    startedAt: '2026-07-01T00:00:00.000Z',
    expiresAt,
    canceledAt: null,
  };
}

test('active option statuses have access', () => {
  assert.equal(optionHasAccess(option('current'), NOW), true);
  assert.equal(optionHasAccess(option('active'), NOW), true);
  assert.equal(optionHasAccess(option('trial'), NOW), true);
});

test('canceled option keeps access only until the paid-through date', () => {
  assert.equal(optionHasAccess(option('canceled', '2026-07-29T00:00:00.000Z'), NOW), true);
  assert.equal(optionHasAccess(option('canceled', '2026-07-27T23:59:59.999Z'), NOW), false);
});

test('grants complimentary access to the YOKO managed account', () => {
  assert.equal(userHasLinkLineOptionAccess('33833959932919231', null, NOW), true);
  assert.equal(userHasLinkLineOptionAccess('another-user', null, NOW), false);
});

test('short links accept only a safe slug and http URLs', () => {
  const result = validateShortLinkInput({
    slug: 'threads_profile',
    destinationUrl: 'https://example.com/path',
    ogpImageUrl: 'https://example.com/ogp.jpg',
  });
  assert.equal(result.slug, 'threads_profile');
  assert.equal(result.destinationUrl, 'https://example.com/path');
  assert.throws(() => validateShortLinkInput({
    slug: '../admin',
    destinationUrl: 'https://example.com',
  }));
  assert.throws(() => validateShortLinkInput({
    slug: 'profile',
    destinationUrl: 'javascript:alert(1)',
  }));
});

test('short links can omit a slug and receive a compact generated code', () => {
  const result = validateShortLinkInput({
    destinationUrl: 'https://example.com/path',
  });
  assert.equal(result.slug, null);
  assert.match(generateShortLinkCode(), /^[23456789abcdefghijkmnpqrstuvwxyz]{7}$/);
});

test('generated short-link codes retry globally occupied IDs', async () => {
  const candidates = ['abc2345', 'def6789'];
  const code = await resolveShortLinkCode(
    null,
    async (candidate) => candidate === 'abc2345',
    () => candidates.shift(),
  );
  assert.equal(code, 'def6789');
});

test('custom short-link IDs must be globally available', async () => {
  await assert.rejects(
    resolveShortLinkCode('profile', async () => true),
    /既に使用されています/,
  );
});
