import assert from 'node:assert/strict';
import test from 'node:test';
import {
  optionHasAccess,
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
