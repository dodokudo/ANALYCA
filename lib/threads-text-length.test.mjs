import assert from 'node:assert/strict';
import test from 'node:test';
import {
  countThreadsText,
  scheduledPostTextLengthErrors,
  validateThreadsTextLength,
} from './threads-text-length.ts';

test('Threads基準では改行と空白も文字数に含める', () => {
  assert.equal(countThreadsText('あ \nい　う'), 6);
});

test('LINEで空白除外492文字に見える532文字の本文を止める', () => {
  const value = `${'あ'.repeat(492)}${'\n'.repeat(40)}`;
  assert.equal(countThreadsText(value), 532);
  assert.equal(
    validateThreadsTextLength('コメント2', value),
    'コメント2は改行・空白込みで532文字です（上限500文字）',
  );
});

test('投稿前検証はメインと全コメントを同じ上限で確認する', () => {
  assert.deepEqual(scheduledPostTextLengthErrors({
    mainText: '本文',
    comment1: 'あ'.repeat(500),
    comment2: 'い'.repeat(501),
  }), ['コメント2は改行・空白込みで501文字です（上限500文字）']);
});
