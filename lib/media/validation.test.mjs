import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeMediaArticleInput,
  normalizeMediaSettings,
  normalizeMediaSlug,
  validatePublishableArticle,
} from './validation.ts';

test('normalizes a readable article slug', () => {
  assert.equal(normalizeMediaSlug(' Instagram 運用 / 2026 '), 'instagram-運用-2026');
});

test('drops unsafe URLs and unknown blocks', () => {
  const article = normalizeMediaArticleInput({
    title: '記事',
    slug: 'article',
    coverImageUrl: 'javascript:alert(1)',
    blocks: [
      { id: 'a', type: 'paragraph', text: '本文' },
      { id: 'b', type: 'unknown', text: '無視' },
      { id: 'c', type: 'cta', url: 'javascript:alert(1)', headline: 'CTA' },
    ],
    sources: [{ title: '危険', url: 'javascript:alert(1)' }, { title: '公式', url: 'https://example.com' }],
  });
  assert.equal(article.coverImageUrl, '');
  assert.equal(article.blocks.length, 2);
  assert.equal(article.blocks[1].type, 'cta');
  assert.equal(article.blocks[1].url, '');
  assert.equal(article.sources.length, 1);
});

test('requires the editorial minimum before approval or publication', () => {
  const article = normalizeMediaArticleInput({ status: 'approved', title: '', blocks: [] });
  const errors = validatePublishableArticle(article);
  assert.ok(errors.includes('タイトルを入力してください'));
  assert.ok(errors.includes('本文を1ブロック以上入力してください'));
  assert.ok(errors.includes('著者名を入力してください'));
});

test('keeps configurable media settings without inventing categories', () => {
  const settings = normalizeMediaSettings({
    siteName: 'Test Media',
    rankingDays: 999,
    pinnedArticleIds: ['a', 'b'],
  });
  assert.equal(settings.siteName, 'Test Media');
  assert.equal(settings.rankingDays, 365);
  assert.deepEqual(settings.pinnedArticleIds, ['a', 'b']);
});
