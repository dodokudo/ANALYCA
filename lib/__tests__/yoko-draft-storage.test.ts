import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

type Row = Record<string, string | number | null>;
const rows = new Map<string, Row>();
let failMerge = false;
const usage: unknown[] = [];
class FakeBigQuery {
  dataset() {
    return { table: () => ({ exists: async () => [true], insert: async (items: unknown[]) => { usage.push(...items); } }) };
  }
  async query({ query, params = {} }: { query: string; params?: Record<string, unknown> }) {
    const id = String(params.draftId || '');
    if (query.includes('ALTER TABLE')) return [[]];
    if (query.includes('MERGE')) {
      if (failMerge) { failMerge = false; throw new Error('temporary database failure'); }
      if (!rows.has(id)) rows.set(id, {
        draft_id: id, user_id: String(params.userId), batch_id: String(params.batchId), draft_number: 1,
        theme: String(params.theme), main_text: String(params.mainText), comment1: String(params.comment1), comment2: String(params.comment2),
        status: 'ready', manual_saved_at: '2026-09-12T00:00:00Z', created_at: '2026-09-12T00:00:00Z', updated_at: '2026-09-12T00:00:00Z',
      });
      return [[]];
    }
    if (query.includes('c.comment_id AS evidence_id')) return [[1,2,3].map(i => ({ evidence_id: `voice${i}`, parent_post_id: `${i}`, parent_text: '宝石', comment_text: `本人の文体${i}`, permalink: '', created_at: '' }))];
    if (query.includes('SELECT @@row_count')) {
      const row = rows.get(id);
      if (!row || row.updated_at !== params.updatedAt || row.status !== 'approved') return [[{ affected: 0 }]];
      Object.assign(row, {
        comment1: params.comment1, comment2: params.comment2, status: params.status,
        approved_main_text: params.approvedMain, approved_comment1: params.approvedComment1, approved_comment2: params.approvedComment2,
        last_error: params.lastError || null, updated_at: '2026-09-12T01:00:00Z',
      });
      return [[{ affected: 1 }]];
    }
    if (query.includes('threads_content_draft_sources')) return [[]];
    if (query.includes('SELECT *') && query.includes('threads_content_drafts_v2')) return [rows.has(id) ? [{ ...rows.get(id) }] : []];
    throw new Error(`Unexpected mock query: ${query.slice(0,50)}`);
  }
}

mock.module('@google-cloud/bigquery', { namedExports: { BigQuery: FakeBigQuery } });
mock.module('../yoko-notion', { namedExports: { getYokoNotionCorePages: async () => ({ styleGuide: { bodyText: '文体ガイド' } }) } });
process.env.OPENAI_API_KEY = 'test-only-not-a-real-key';
const { createManualReadyDraft, styleYokoDrafts } = await import('../threads-content-drafts');
const requestId = 'e17bb0d7-19de-4ac1-957e-b04c3a4a9789';
const input = { requestId, mainText: 'そのまま保存\nメイン', comment1: '短い原稿1', comment2: '短い原稿2' };

test('手動作成は完成・保存済みとして保存し、同じ作成リクエストを再送しても増えない', async () => {
  const first = await createManualReadyDraft(input);
  const second = await createManualReadyDraft(input);
  assert.equal(first.id,second.id);
  assert.equal(first.status,'ready');
  assert.equal(first.mainText,input.mainText);
  assert.equal(first.comment1,input.comment1);
  assert.equal(first.manualSavedAt,'2026-09-12T00:00:00Z');
  assert.equal(first.scheduleId,null);
  assert.equal(first.lineMessageId,null);
  assert.equal(first.sources.length,0);
  assert.equal(rows.size,1);
  assert.equal(usage.length,0);
  await assert.rejects(createManualReadyDraft({ ...input, comment1: '別の原稿' }), /別の投稿/);
  assert.equal(rows.get(requestId)?.comment1,input.comment1);
});

test('手動作成の一時的なDB失敗後に同じ入力で再保存できる', async () => {
  const retry = { ...input, requestId: 'a80c3e18-f7c7-472e-b9d2-7cd9d9682164' };
  failMerge = true;
  await assert.rejects(createManualReadyDraft(retry), /temporary/);
  assert.equal((await createManualReadyDraft(retry)).status,'ready');
});

const styled = Array(20).fill('あ'.repeat(20)).join('\n');
function approved(id: string): Row {
  return { draft_id:id,user_id:'33833959932919231',batch_id:'batch',draft_number:1,theme:'テーマ',main_text:'編集済みメイン',comment1:'採用原文1',comment2:'採用原文2',status:'approved',created_at:'2026-09-12T00:00:00Z',updated_at:'2026-09-12T00:00:00Z',last_error:null };
}
function aiResponse(value: unknown): Response {
  return Response.json({ output:[{ content:[{ type:'output_text',text:JSON.stringify(value) }] }], usage:{ input_tokens:10,output_tokens:10 } });
}
function stubAI(onAudit?: () => void) {
  return mock.method(globalThis,'fetch',async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const prompt = JSON.parse(body.input);
    if (body.text.format.name === 'yoko_style_transform') {
      assert.equal(prompt.drafts[0].primarySource,undefined);
      return aiResponse({ drafts:prompt.drafts.map((draft: { draftId: string }) => ({ draftId:draft.draftId,main_text:'変更してはいけない',comment1:styled,comment2:styled,voiceEvidenceIds:['voice1','voice2','voice3'] })) });
    }
    assert.equal(prompt.drafts[0].primarySource,undefined);
    onAudit?.();
    return aiResponse({ drafts:prompt.drafts.map((draft: { draftId: string }) => ({ draftId:draft.draftId,contentPreserved:true,styleMatches:true,evidenceGrounded:true,issues:[] })) });
  });
}

test('文体合格で文体確認に進み、メインと採用原文を保持する', async () => {
  rows.set('style-ok',approved('style-ok'));
  const fetchMock = stubAI();
  try {
    const [draft] = await styleYokoDrafts({ draftIds:['style-ok'],fields:['comment1','comment2'] });
    assert.equal(draft.status,'style_review');
    assert.equal(draft.mainText,'編集済みメイン');
    assert.equal(draft.comment1,styled);
    assert.equal(draft.approvedSnapshot?.comment1,'採用原文1');
  } finally { fetchMock.mock.restore(); }
});

test('処理中に保存された人の編集をAI結果で上書きしない', async () => {
  rows.set('concurrent',approved('concurrent'));
  const fetchMock = stubAI(() => Object.assign(rows.get('concurrent')!, { comment1:'別画面で保存した文章',updated_at:'2026-09-12T00:00:01Z' }));
  try {
    await assert.rejects(styleYokoDrafts({ draftIds:['concurrent'],fields:['comment1','comment2'] }), /処理中に変更/);
    assert.equal(rows.get('concurrent')?.comment1,'別画面で保存した文章');
    assert.equal(rows.get('concurrent')?.status,'approved');
  } finally { fetchMock.mock.restore(); }
});

test('保存済みのNG稿は明示的な再調整なしに書き換えない', async () => {
  rows.set('saved', { ...approved('saved'),last_error:'本人文体監査NG（修正稿は保持）: 指摘',approved_main_text:'編集済みメイン',approved_comment1:'初回採用1',approved_comment2:'初回採用2',comment1:'手で修正済み' });
  await assert.rejects(styleYokoDrafts({ draftIds:['saved'],fields:['comment1','comment2'] }), /AIで再調整/);
  assert.equal(rows.get('saved')?.comment1,'手で修正済み');
  const fetchMock = stubAI();
  try {
    const [draft] = await styleYokoDrafts({ draftIds:['saved'],fields:['comment1','comment2'],retrySaved:true });
    assert.equal(draft.status,'style_review');
    assert.equal(draft.approvedSnapshot?.comment1,'初回採用1');
  } finally { fetchMock.mock.restore(); }
});
