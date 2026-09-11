import assert from 'node:assert/strict';
import test from 'node:test';
import { manualDraftErrors, parseManualDraft } from '../yoko-manual-draft';
import { isDraftReadyForLine } from '../line-draft-selection';
import { runYokoStyleRepair, type StyleCandidate, type StyleRepairJob, type StyleAudit } from '../yoko-style-pipeline';

const requestId = '3d4cf67a-9441-4d14-bffe-e4a66960b655';
const manual = { requestId, theme: '', mainText: '貼り付けた原稿\nそのまま残す', comment1: '短いコメント1', comment2: '短いコメント2' };
const pass: StyleAudit = { contentPreserved: true, styleMatches: true, evidenceGrounded: true, issues: [] };
const candidate = (comment1: string): StyleCandidate => ({ mainText: '人が編集したメイン', comment1, comment2: 'コメント2', voiceEvidenceIds: ['a','b','c'] });
const jobs = (ids: string[]): StyleRepairJob[] => ids.map(id => ({ id, candidate: candidate('採用原文'), issues: [] }));

test('手動原稿は短いコメントも完成へ保存でき、改行・本文を変更しない', () => {
  const parsed = parseManualDraft(manual);
  assert.equal(parsed.theme, '貼り付けた原稿');
  assert.equal(parsed.mainText, manual.mainText);
  assert.equal(parsed.comment1, manual.comment1);
  assert.deepEqual(manualDraftErrors(parsed), []);
  assert.equal(isDraftReadyForLine({ status: 'ready', lineMessageId: null, scheduleId: null, threadId: null }), true);
});

test('手動作成は各欄の空白のみ・改行込み超過・不正な作成IDを拒否する', () => {
  for (const field of ['mainText','comment1','comment2']) {
    assert.throws(() => parseManualDraft({ ...manual, [field]: ' \n　' }), /入力/);
    assert.throws(() => parseManualDraft({ ...manual, [field]: 'あ'.repeat(499) + '\nい' }), /500文字/);
    assert.doesNotThrow(() => parseManualDraft({ ...manual, [field]: '😀'.repeat(500) }));
  }
  assert.throws(() => parseManualDraft({ ...manual, requestId: 'bad' }), /作成情報/);
  assert.throws(() => parseManualDraft({ ...manual, comment1: 1 }), /入力/);
});

test('文字数NGだけを自動修正し、合格済みの稿は書き換えない', async () => {
  const calls: string[][] = [];
  const auditCalls: string[][] = [];
  const originalJobs = jobs(['ok','over']);
  const snapshot = JSON.stringify(originalJobs);
  const result = await runYokoStyleRepair({
    jobs: originalJobs,
    transform: async (pending, attempt) => {
      calls.push(pending.map(job => job.id));
      if (attempt === 1) assert.deepEqual(pending[0].issues, ['500文字超過']);
      return new Map(pending.map(job => [job.id, candidate(job.id === 'over' && attempt === 0 ? '長'.repeat(528) : `合格${job.id}`)]));
    },
    validate: value => value.comment1.length > 500 ? ['500文字超過'] : [],
    audit: async pending => {
      auditCalls.push(pending.map(job => job.id));
      return new Map(pending.map(job => [job.id, pass]));
    },
  });
  assert.deepEqual(calls, [['ok','over'],['over']]);
  assert.deepEqual(auditCalls, [['ok'],['over']]);
  assert.equal(result.every(item => item.passed), true);
  assert.equal(result[0].candidate?.comment1, '合格ok');
  assert.equal(JSON.stringify(originalJobs), snapshot);
});

test('AI監査の具体的な指摘を修正に戻し、合格まで再監査する', async () => {
  let audits = 0;
  const result = await runYokoStyleRepair({
    jobs: jobs(['a']),
    transform: async (pending, attempt) => {
      if (attempt === 1) assert.deepEqual(pending[0].issues, ['採用原文の結論が欠落']);
      return new Map([['a',candidate(attempt ? '結論あり' : '結論なし')]]);
    },
    validate: () => [],
    audit: async () => new Map([['a', ++audits === 1 ? { ...pass, contentPreserved: false, issues: ['採用原文の結論が欠落'] } : pass]]),
  });
  assert.equal(audits,2);
  assert.equal(result[0].passed,true);
  assert.equal(result[0].candidate?.comment1,'結論あり');
});

test('修正2回で合格しない場合は最後の案と指摘を保持し、完成扱いにしない', async () => {
  let transforms = 0;
  const result = await runYokoStyleRepair({
    jobs: jobs(['a']),
    transform: async () => new Map([['a',candidate(`案${++transforms}`)]]),
    validate: () => ['文字数不足'],
    audit: async () => { throw new Error('機械チェックNGをAI監査に送ってはいけない'); },
  });
  assert.equal(transforms,3);
  assert.equal(result[0].passed,false);
  assert.equal(result[0].candidate?.comment1,'案3');
  assert.deepEqual(result[0].issues,['文字数不足']);
});

test('監査欠落を合格扱いにせず再試行する', async () => {
  let audits = 0;
  const result = await runYokoStyleRepair({
    jobs: jobs(['a']),
    transform: async () => new Map([['a',candidate('案')]]),
    validate: () => [],
    audit: async () => { audits++; return new Map(); },
  });
  assert.equal(audits,3);
  assert.equal(result[0].passed,false);
});

test('再試行のAPI失敗でも、合格済み稿と直前の案を失わない', async () => {
  const result = await runYokoStyleRepair({
    jobs: jobs(['ok','bad']),
    transform: async (pending, attempt) => {
      if (attempt > 0) throw new Error('network');
      return new Map(pending.map(job => [job.id,candidate(job.id)]));
    },
    validate: value => value.comment1 === 'bad' ? ['修正が必要'] : [],
    audit: async pending => new Map(pending.map(job => [job.id,pass])),
  });
  assert.equal(result[0].passed,true);
  assert.equal(result[1].passed,false);
  assert.equal(result[1].candidate?.comment1,'bad');
});

test('監査の通信失敗では未監査の案を合格にせず、再変換もしない', async () => {
  let transforms = 0;
  const result = await runYokoStyleRepair({
    jobs: jobs(['a']),
    transform: async () => { transforms++; return new Map([['a',candidate('保存対象の案')]]); },
    validate: () => [],
    audit: async () => { throw new Error('timeout'); },
  });
  assert.equal(transforms,1);
  assert.equal(result[0].passed,false);
  assert.equal(result[0].candidate?.comment1,'保存対象の案');
});
