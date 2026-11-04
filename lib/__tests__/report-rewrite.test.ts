import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import {
  emptyRewrite, parseRewriteWrite, REWRITE_GROUPS, RewriteEditor, submissionIssues,
  type ReportRewrite, type RewriteRevision,
} from '../report-rewrite';

function complete(): ReportRewrite {
  const report = emptyRewrite();
  report.summary = '確認した結果\n改行も保持'; report.issue = '比較条件は未確認'; report.direction = '来月に確認';
  report.objective = '問い合わせを増やす'; report.postsNote = '投稿の確認待ち';
  report.funnelNote = '流入経路を確認する'; report.requestsNote = '今月のお願いはありません';
  for (const group of REWRITE_GROUPS.filter(group => !['posts', 'requests'].includes(group.key))) {
    (report[group.key] as Record<string, string>[]) = [Object.fromEntries(group.fields.map(field => [field.key,
      'options' in field ? field.options[0] : '未確認']))];
  }
  return report;
}

test('途中の下書きを保存でき、未完成の提出は拒否する', () => {
  const input = { expectedRevision: 0, requestId: randomUUID(), report: emptyRewrite(), status: 'draft' };
  assert.deepEqual(parseRewriteWrite(input).report, emptyRewrite());
  assert.throws(() => parseRewriteWrite({ ...input, status: 'submitted' }), /今月の結果/);
  assert.deepEqual(submissionIssues(complete()), []);
  assert.deepEqual(parseRewriteWrite({ ...input, report: complete(), status: 'submitted' }).report, complete());
});

test('行の構造・件数上限・選択肢・危険なURLをサーバーで検証する', () => {
  const input = { expectedRevision: 0, requestId: randomUUID(), report: complete(), status: 'draft' };
  for (const report of [
    { ...complete(), activities: null },
    { ...complete(), plans: Array(4).fill(complete().plans[0]) },
    { ...complete(), metrics: [{ ...complete().metrics[0], kind: '適当' }] },
    { ...complete(), summary: 'あ'.repeat(601) },
    { ...complete(), posts: [{ signal: '良かった', content: '', url: 'javascript:alert(1)', metric: '', reason: '', nextAction: '' }] },
  ]) assert.throws(() => parseRewriteWrite({ ...input, report }));
  const safe = { signal: '良かった', content: '内容', url: 'https://example.com/post', metric: '10件', reason: '仮説', nextAction: '確認' };
  assert.equal(parseRewriteWrite({ ...input, report: { ...complete(), posts: [safe] } }).report.posts[0].url, safe.url);
});

test('応答喪失時は同一内容を再送し、確認できた保存だけを受け入れる', () => {
  const editor = new RewriteEditor(null);
  editor.report = complete();
  const pending = editor.begin('submitted', randomUUID());
  editor.report.summary = '保存要求後の入力';
  assert.deepEqual(editor.begin('draft', randomUUID()), pending);
  const saved: RewriteRevision = { report: pending.report, status: pending.status, requestId: pending.requestId, revision: 1, savedAt: '2026-11-05T00:00:00Z' };
  assert.throws(() => editor.acknowledge({ ...saved, status: 'draft' }), /保存内容/);
  assert.throws(() => editor.acknowledge({ ...saved, report: emptyRewrite() }), /保存内容/);
  assert.throws(() => editor.acknowledge({ ...saved, revision: 2 }), /保存内容/);
  editor.acknowledge(saved);
  assert.equal(editor.revision, 1);
  assert.equal(editor.report.summary, '保存要求後の入力');
  assert.equal(editor.dirty, true);
  assert.equal(editor.pending, null);
  assert.deepEqual(new RewriteEditor(saved).report, pending.report);
});
