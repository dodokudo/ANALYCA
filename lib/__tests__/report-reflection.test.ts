import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { EMPTY_REFLECTION, ReflectionEditor, parseReflectionWrite, type ReflectionRevision } from '../report-reflection';

function saved(editor: ReflectionEditor): ReflectionRevision {
  const request = editor.pending!;
  return { fields: request.fields, requestId: request.requestId, revision: request.expectedRevision + 1, savedAt: '2026-10-03T00:00:00Z' };
}

test('保存した改行・日本語・空欄を変更せず、再表示できる', () => {
  const editor = new ReflectionEditor(null);
  editor.fields.summary = '今月の振り返り\n\n閲覧が増えました。';
  editor.fields.nextMonth = '来月の計画';
  const request = parseReflectionWrite(editor.begin(randomUUID()));
  const response = saved(editor);
  editor.acknowledge(response);
  assert.equal(editor.dirty, false);
  assert.deepEqual(new ReflectionEditor(JSON.parse(JSON.stringify(response))).fields, request.fields);
});

test('保存中に続けた入力を、古い保存レスポンスで消さない', () => {
  const editor = new ReflectionEditor(null);
  editor.fields.summary = '送信した文章';
  editor.begin(randomUUID());
  editor.fields = { ...editor.fields, summary: '送信後に入力した文章' };
  editor.acknowledge(saved(editor));
  assert.equal(editor.fields.summary, '送信後に入力した文章');
  assert.equal(editor.savedFields.summary, '送信した文章');
  assert.equal(editor.dirty, true);
  assert.equal(editor.begin(randomUUID()).expectedRevision, 1);
});

test('通信失敗や応答喪失の再保存は同じリクエストを再送する', () => {
  const editor = new ReflectionEditor(null);
  editor.fields.results = '変更前';
  const first = editor.begin(randomUUID());
  editor.fields = { ...editor.fields, results: '変更後' };
  assert.deepEqual(editor.begin(randomUUID()), first);
  editor.acknowledge(saved(editor));
  const next = editor.begin(randomUUID());
  assert.notEqual(next.requestId, first.requestId);
  assert.equal(next.fields.results, '変更後');
  assert.equal(next.expectedRevision, 1);
});

test('保存内容・リクエスト・版が一致しなければ保存済みにしない', () => {
  for (const change of [ { requestId: randomUUID() }, { revision: 99 }, { fields: { ...EMPTY_REFLECTION, summary: '異なる内容' } } ]) {
    const editor = new ReflectionEditor(null);
    editor.fields.summary = '保存したい内容';
    editor.begin(randomUUID());
    assert.throws(() => editor.acknowledge({ ...saved(editor), ...change }), /保存内容/);
    assert.equal(editor.dirty, true);
    assert.ok(editor.pending);
  }
});

test('不正な保存要求や文字数超過を拒否し、空欄への変更は保存できる', () => {
  const input = { expectedRevision: 0, requestId: randomUUID(), fields: EMPTY_REFLECTION };
  assert.deepEqual(parseReflectionWrite(input).fields, EMPTY_REFLECTION);
  for (const bad of [null, { ...input, expectedRevision: -1 }, { ...input, requestId: 'bad' },
    { ...input, fields: { ...EMPTY_REFLECTION, summary: 2 } },
    { ...input, fields: { ...EMPTY_REFLECTION, summary: 'あ'.repeat(10001) } }]) {
    assert.throws(() => parseReflectionWrite(bad));
  }
});
