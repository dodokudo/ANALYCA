import assert from 'node:assert/strict';
import test from 'node:test';
import { validateGeneratedDrafts } from '../threads-content-drafts';

function draft(overrides: Partial<{
  sourcePageId: string;
  theme: string;
  mainText: string;
  comment1: string;
  comment2: string;
}> = {}) {
  return {
    sourcePageId: 'source-1',
    theme: 'テーマ',
    mainText: '一行だけ',
    comment1: 'あ'.repeat(370),
    comment2: 'い'.repeat(500),
    ...overrides,
  };
}

test('メインは最低文字数なし、50文字以下を許可する', () => {
  assert.deepEqual(validateGeneratedDrafts([draft()], 1), []);
  assert.deepEqual(validateGeneratedDrafts([draft({ mainText: 'あ'.repeat(50) })], 1), []);
  assert.match(validateGeneratedDrafts([draft({ mainText: 'あ'.repeat(51) })], 1).join(' / '), /メインが51文字/);
});

test('コメントは370〜500文字を許可する', () => {
  assert.deepEqual(validateGeneratedDrafts([draft()], 1), []);
  assert.match(validateGeneratedDrafts([draft({ comment1: 'あ'.repeat(369) })], 1).join(' / '), /コメント1が369文字/);
  assert.match(validateGeneratedDrafts([draft({ comment2: 'い'.repeat(501) })], 1).join(' / '), /コメント2が501文字/);
});
