import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applySelectedStyleFields,
  selectYokoVoiceEvidence,
  validateGeneratedDrafts,
  validateYokoStyleCandidate,
  type YokoVoiceEvidence,
} from '../threads-content-drafts';

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

test('コメントだけの文体調整ではメイン投稿を変更しない', () => {
  const result = applySelectedStyleFields(
    { mainText: '工藤さんが編集したメイン', comment1: '元コメント1', comment2: '元コメント2' },
    { main_text: 'AIが変更したメイン', comment1: '本人文体コメント1', comment2: '本人文体コメント2' },
    ['comment1', 'comment2'],
  );
  assert.equal(result.mainText, '工藤さんが編集したメイン');
  assert.equal(result.comment1, '本人文体コメント1');
  assert.equal(result.comment2, '本人文体コメント2');
});

test('投稿テーマに近い本人コメントをVOICE_EVIDENCEとして優先する', () => {
  const evidence = (id: string, text: string): YokoVoiceEvidence => ({
    id,
    parentPostId: `parent-${id}`,
    parentText: text,
    commentText: text,
    permalink: '',
    createdAt: '2026-08-11T00:00:00.000Z',
  });
  const selected = selectYokoVoiceEvidence({
    theme: 'ダイヤモンドのカラーグレード',
    mainText: 'ダイヤの色を解説します',
    comment1: 'DカラーとFカラーの違いです',
    comment2: '無色感を確認してください',
    approvedSnapshot: null,
    sources: [],
  }, [
    evidence('pearl', '真珠のテリとオリエントを太陽光で確認します'),
    evidence('diamond', 'ダイヤモンドのカラーはDからZまで。無色感を見るならFカラー以上を確認してください'),
    evidence('ring', 'リングを着ける指の意味を解説します'),
  ], 1);
  assert.equal(selected[0]?.id, 'diamond');
});

test('均一な説明文と硬い否定表現の連発を本人文体として通さない', () => {
  const issues = validateYokoStyleCandidate({
    comment1: 'これは正解ではありません。'.repeat(20),
    comment2: 'それだけで決めるわけではありません。'.repeat(20),
  });
  assert.match(issues.join(' / '), /改行が少なすぎます/);
  assert.match(issues.join(' / '), /硬い否定表現/);
});

test('「偽物でも加工でもありません」も硬い否定として止める', () => {
  const lines = Array.from({ length: 10 }, (_, index) => (
    index === 0 ? '偽物でも加工でもありません。' : '短い本人文体です。'
  )).join('\n');
  assert.match(validateYokoStyleCandidate({ comment1: lines, comment2: lines }).join(' / '), /硬い否定表現/);
});

test('短い改行と会話調の否定を含む本人文体候補を通す', () => {
  const conversationalLines = [
    'まず結論から言うと、',
    'ここだけは見てください。',
    '同じに見えても、',
    '中身は全部同じじゃないです。',
    'なぜなら、',
    '選ぶ基準が違うからです。',
    'でも、',
    '全部ダメって意味じゃないです。',
    '大事なのは、',
    '何を優先するかです。',
  ].join('\n');
  assert.deepEqual(validateYokoStyleCandidate({
    comment1: conversationalLines,
    comment2: conversationalLines,
  }), []);
});
