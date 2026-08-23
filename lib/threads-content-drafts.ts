import { randomUUID } from 'node:crypto';
import { BigQuery } from '@google-cloud/bigquery';
import { getYokoNotionCorePages } from '@/lib/yoko-notion';
import {
  listYokoNotionSources,
  markYokoNotionSourceGenerated,
  YOKO_ANALYCA_USER_ID,
  type YokoNotionSourceRecord,
} from '@/lib/yoko-notion-ledger';

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID;
const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS || '{}';
const DATASET = 'analyca';
const BATCH_TABLE = 'threads_content_batches';
const DRAFT_TABLE = 'threads_content_drafts_v2';
const SOURCE_TABLE = 'threads_content_draft_sources';
const USAGE_TABLE = 'threads_ai_usage';
const STORED_STYLE_AUDIT_ERROR_PREFIX = '本人文体監査NG（監査案保存済み）:';
const MAX_GENERATION_REPAIR_ATTEMPTS = 2;

export type ThreadsContentStatus = 'review' | 'approved' | 'style_review' | 'stock' | 'discarded' | 'ready' | 'line_sent';
export type ThreadsContentField = 'main_text' | 'comment1' | 'comment2';

export type ThreadsContentSource = {
  notionPageId: string;
  sourceType: 'instagram_script' | 'gem_knowledge';
  role: 'primary' | 'reference' | 'knowledge';
  title: string;
  url: string;
  bodyText: string;
};

export type YokoVoiceEvidence = {
  id: string;
  parentPostId: string;
  parentText: string;
  commentText: string;
  permalink: string;
  createdAt: string;
};

export type ThreadsContentDraft = {
  id: string;
  batchId: string;
  number: number;
  theme: string;
  mainText: string;
  comment1: string;
  comment2: string;
  status: ThreadsContentStatus;
  approvedSnapshot: { mainText: string; comment1: string; comment2: string } | null;
  lineMessageId: string | null;
  scheduleId: string | null;
  threadId: string | null;
  lastError: string | null;
  manualSavedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sources: ThreadsContentSource[];
};

export type ThreadsContentListResult = {
  drafts: ThreadsContentDraft[];
  total: number;
  page: number;
  pageSize: number;
  usage: { inputTokens: number; outputTokens: number; estimatedCostUsd: number | null };
  counts: Partial<Record<ThreadsContentStatus, number>>;
};

type OpenAIUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
};

const OPENAI_MODEL_PRICING_USD_PER_MILLION: Record<string, {
  input: number;
  cachedInput: number;
  output: number;
}> = {
  'gpt-5.6-sol': { input: 5, cachedInput: 0.5, output: 30 },
  'gpt-5.6': { input: 5, cachedInput: 0.5, output: 30 },
  'gpt-5.6-terra': { input: 2.5, cachedInput: 0.25, output: 15 },
  'gpt-5.6-luna': { input: 1, cachedInput: 0.1, output: 6 },
};

type GeneratedDraft = {
  sourcePageId: string;
  theme: string;
  mainText: string;
  comment1: string;
  comment2: string;
};

function parseCredentials(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

const client = new BigQuery({ projectId, credentials: parseCredentials(credentialsJson) });

const TABLE_SCHEMAS = {
  [BATCH_TABLE]: [
    { name: 'batch_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'status', type: 'STRING', mode: 'REQUIRED' },
    { name: 'requested_count', type: 'INTEGER', mode: 'REQUIRED' },
    { name: 'created_count', type: 'INTEGER', mode: 'REQUIRED' },
    { name: 'created_by', type: 'STRING', mode: 'NULLABLE' },
    { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
    { name: 'updated_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
  ],
  [DRAFT_TABLE]: [
    { name: 'draft_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'batch_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'draft_number', type: 'INTEGER', mode: 'REQUIRED' },
    { name: 'theme', type: 'STRING', mode: 'REQUIRED' },
    { name: 'main_text', type: 'STRING', mode: 'REQUIRED' },
    { name: 'comment1', type: 'STRING', mode: 'REQUIRED' },
    { name: 'comment2', type: 'STRING', mode: 'REQUIRED' },
    { name: 'approved_main_text', type: 'STRING', mode: 'NULLABLE' },
    { name: 'approved_comment1', type: 'STRING', mode: 'NULLABLE' },
    { name: 'approved_comment2', type: 'STRING', mode: 'NULLABLE' },
    { name: 'status', type: 'STRING', mode: 'REQUIRED' },
    { name: 'line_message_id', type: 'STRING', mode: 'NULLABLE' },
    { name: 'schedule_id', type: 'STRING', mode: 'NULLABLE' },
    { name: 'thread_id', type: 'STRING', mode: 'NULLABLE' },
    { name: 'last_error', type: 'STRING', mode: 'NULLABLE' },
    { name: 'manual_saved_at', type: 'TIMESTAMP', mode: 'NULLABLE' },
    { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
    { name: 'updated_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
  ],
  [SOURCE_TABLE]: [
    { name: 'draft_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'notion_page_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'source_type', type: 'STRING', mode: 'REQUIRED' },
    { name: 'source_role', type: 'STRING', mode: 'REQUIRED' },
    { name: 'source_title', type: 'STRING', mode: 'REQUIRED' },
    { name: 'source_url', type: 'STRING', mode: 'REQUIRED' },
    { name: 'source_body_text', type: 'STRING', mode: 'NULLABLE' },
    { name: 'source_content_hash', type: 'STRING', mode: 'REQUIRED' },
    { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
  ],
  [USAGE_TABLE]: [
    { name: 'usage_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'batch_id', type: 'STRING', mode: 'NULLABLE' },
    { name: 'draft_id', type: 'STRING', mode: 'NULLABLE' },
    { name: 'operation', type: 'STRING', mode: 'REQUIRED' },
    { name: 'model', type: 'STRING', mode: 'REQUIRED' },
    { name: 'input_tokens', type: 'INTEGER', mode: 'REQUIRED' },
    { name: 'output_tokens', type: 'INTEGER', mode: 'REQUIRED' },
    { name: 'cached_tokens', type: 'INTEGER', mode: 'REQUIRED' },
    { name: 'reasoning_tokens', type: 'INTEGER', mode: 'REQUIRED' },
    { name: 'estimated_cost_usd', type: 'FLOAT', mode: 'NULLABLE' },
    { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
  ],
} as const;

let ensureTablesPromise: Promise<void> | null = null;

async function ensureTables(): Promise<void> {
  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
      const dataset = client.dataset(DATASET);
      for (const [tableName, schema] of Object.entries(TABLE_SCHEMAS)) {
        const table = dataset.table(tableName);
        const [exists] = await table.exists();
        if (exists) continue;
        try {
          await dataset.createTable(tableName, { schema: [...schema] });
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (!message.includes('Already Exists')) throw error;
        }
      }
      await client.query({
        query: `ALTER TABLE \`${projectId}.${DATASET}.${DRAFT_TABLE}\` ADD COLUMN IF NOT EXISTS manual_saved_at TIMESTAMP`,
      });
    })().catch((error) => {
      ensureTablesPromise = null;
      throw error;
    });
  }
  return ensureTablesPromise;
}

function plain(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && 'value' in value) {
    return plain((value as { value?: unknown }).value);
  }
  return String(value);
}

function integer(value: unknown): number {
  const parsed = Number(plain(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeForDuplicateCheck(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}

function relevantKnowledge(script: YokoNotionSourceRecord, knowledge: YokoNotionSourceRecord[]): YokoNotionSourceRecord[] {
  const haystack = `${script.source_title}\n${script.body_text}`.normalize('NFKC').toLowerCase();
  const tokens = Array.from(new Set(haystack.match(/[一-龠々ぁ-んァ-ヶー]{2,}|[a-z0-9]{3,}/g) || []));
  return knowledge
    .map((item) => ({ item, score: tokens.reduce((score, token) => score + (item.body_text.toLowerCase().includes(token) ? 1 : 0), 0) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map(({ item }) => item);
}

async function usedNotionPageIds(): Promise<Set<string>> {
  await ensureTables();
  const [rows] = await client.query({
    query: `
      SELECT DISTINCT source.notion_page_id
      FROM \`${projectId}.${DATASET}.${SOURCE_TABLE}\` source
      JOIN \`${projectId}.${DATASET}.${DRAFT_TABLE}\` draft USING (draft_id)
      WHERE source.user_id = @userId
        AND source.source_type = 'instagram_script'
    `,
    params: { userId: YOKO_ANALYCA_USER_ID },
  });
  return new Set(rows.map((row) => plain(row.notion_page_id)).filter(Boolean));
}

export function selectYokoSources(
  sources: YokoNotionSourceRecord[],
  usedIds: Set<string>,
  count = 6,
): YokoNotionSourceRecord[] {
  const available = sources.filter((source) => !source.archived && source.body_text && !usedIds.has(source.notion_page_id));
  const newSource = available.find((source) => source.source_origin === 'new' && source.generation_status === 'unprocessed');
  const selected = newSource ? [newSource] : [];
  for (const source of available) {
    if (selected.length >= count) break;
    if (selected.some((item) => item.notion_page_id === source.notion_page_id)) continue;
    selected.push(source);
  }
  return selected;
}

async function existingThreadsText(): Promise<string[]> {
  const queries = [
    `SELECT text FROM \`${projectId}.${DATASET}.threads_posts\` WHERE user_id = @userId`,
    `SELECT text FROM \`${projectId}.${DATASET}.threads_comments\` WHERE user_id = @userId`,
    `SELECT CONCAT(main_text, ' ', comment1, ' ', comment2) AS text FROM \`${projectId}.${DATASET}.scheduled_posts\` WHERE user_id = @userId`,
  ];
  const result: string[] = [];
  for (const query of queries) {
    try {
      const [rows] = await client.query({ query, params: { userId: YOKO_ANALYCA_USER_ID } });
      result.push(...rows.map((row) => plain(row.text)).filter(Boolean));
    } catch (error) {
      console.warn('[threads-content] duplicate source query skipped', error);
    }
  }
  return result;
}

function openAIKey(): string {
  const key = process.env.OPENAI_API_KEY || '';
  if (!key) throw new Error('OPENAI_API_KEY is not configured');
  return key;
}

function extractOutputText(response: Record<string, unknown>): string {
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as { content?: unknown[] }).content)
      ? (item as { content: unknown[] }).content
      : [];
    for (const part of content) {
      if (part && typeof part === 'object' && (part as { type?: string }).type === 'output_text') {
        return plain((part as { text?: unknown }).text);
      }
    }
  }
  throw new Error('OpenAI response did not contain output_text');
}

function responseUsage(response: Record<string, unknown>): OpenAIUsage {
  const usage = response.usage && typeof response.usage === 'object'
    ? response.usage as Record<string, unknown>
    : {};
  const inputDetails = usage.input_tokens_details && typeof usage.input_tokens_details === 'object'
    ? usage.input_tokens_details as Record<string, unknown>
    : {};
  const outputDetails = usage.output_tokens_details && typeof usage.output_tokens_details === 'object'
    ? usage.output_tokens_details as Record<string, unknown>
    : {};
  return {
    inputTokens: integer(usage.input_tokens),
    outputTokens: integer(usage.output_tokens),
    cachedTokens: integer(inputDetails.cached_tokens),
    reasoningTokens: integer(outputDetails.reasoning_tokens),
  };
}

async function callOpenAI(input: {
  model: string;
  instructions: string;
  prompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
  verbosity?: 'low' | 'medium' | 'high';
}): Promise<{ json: unknown; usage: OpenAIUsage; responseId: string }> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAIKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model,
      reasoning: { effort: process.env.OPENAI_REASONING_EFFORT || 'low' },
      instructions: input.instructions,
      input: input.prompt,
      store: false,
      text: {
        verbosity: input.verbosity || 'low',
        format: {
          type: 'json_schema',
          name: input.schemaName,
          strict: true,
          schema: input.schema,
        },
      },
    }),
  });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    const message = payload.error && typeof payload.error === 'object'
      ? plain((payload.error as { message?: unknown }).message)
      : JSON.stringify(payload).slice(0, 500);
    throw new Error(`OpenAI API error ${response.status}: ${message}`);
  }
  return {
    json: JSON.parse(extractOutputText(payload)),
    usage: responseUsage(payload),
    responseId: plain(payload.id),
  };
}

export function estimateOpenAICost(model: string, usage: OpenAIUsage): number | null {
  const modelPricing = OPENAI_MODEL_PRICING_USD_PER_MILLION[model];
  const inputRate = modelPricing?.input ?? Number(process.env.OPENAI_INPUT_USD_PER_MILLION || '');
  const cachedInputRate = modelPricing?.cachedInput ?? Number(process.env.OPENAI_CACHED_INPUT_USD_PER_MILLION || '');
  const outputRate = modelPricing?.output ?? Number(process.env.OPENAI_OUTPUT_USD_PER_MILLION || '');
  if (!Number.isFinite(inputRate) || !Number.isFinite(cachedInputRate) || !Number.isFinite(outputRate)) return null;
  const uncachedTokens = Math.max(usage.inputTokens - usage.cachedTokens, 0);
  return (
    uncachedTokens * inputRate
    + usage.cachedTokens * cachedInputRate
    + usage.outputTokens * outputRate
  ) / 1_000_000;
}

async function recordUsage(input: {
  operation: 'draft_generation' | 'draft_repair' | 'style_transform' | 'style_audit';
  model: string;
  usage: OpenAIUsage;
  batchId?: string;
  draftId?: string;
}): Promise<void> {
  await ensureTables();
  await client.dataset(DATASET).table(USAGE_TABLE).insert([{
    usage_id: randomUUID(),
    user_id: YOKO_ANALYCA_USER_ID,
    batch_id: input.batchId || null,
    draft_id: input.draftId || null,
    operation: input.operation,
    model: input.model,
    input_tokens: input.usage.inputTokens,
    output_tokens: input.usage.outputTokens,
    cached_tokens: input.usage.cachedTokens,
    reasoning_tokens: input.usage.reasoningTokens,
    estimated_cost_usd: estimateOpenAICost(input.model, input.usage),
    created_at: new Date().toISOString(),
  }]);
}

function generationSchema(count: number, allowedSourceIds: readonly string[]): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['drafts'],
    properties: {
      drafts: {
        type: 'array',
        minItems: count,
        maxItems: count,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['sourcePageId', 'theme', 'mainText', 'comment1', 'comment2'],
          properties: {
            sourcePageId: { type: 'string', enum: [...allowedSourceIds] },
            theme: { type: 'string' },
            mainText: { type: 'string' },
            comment1: { type: 'string' },
            comment2: { type: 'string' },
          },
        },
      },
    },
  };
}

function contentLength(value: string): number {
  return Array.from(value.replace(/[\s\u3000]/g, '')).length;
}

function isGenerationRefusal(draft: GeneratedDraft): boolean {
  const text = `${draft.theme}\n${draft.mainText}\n${draft.comment1}\n${draft.comment2}`;
  return [
    /(?:元|入力された|候補)台本[\s\S]{0,80}(?:含まれていません|ありません|確認する必要があります)/,
    /投稿を(?:完成|作成)することはできません/,
    /(?:元台本|候補台本|宝石ノウハウ)を指定してください/,
    /(?:既存|新規).{0,12}台本に基づく投稿/,
  ].some((pattern) => pattern.test(text));
}

export function validationErrorsForDraft(errors: readonly string[], draftNumber: number): string[] {
  const prefix = `投稿${draftNumber}:`;
  return errors.filter((error) => error.startsWith(prefix));
}

export function validateGeneratedDrafts(
  drafts: GeneratedDraft[],
  count: number,
  allowedSourceIds: readonly string[] = [],
): string[] {
  const errors: string[] = [];
  const allowedSourceIdSet = new Set(allowedSourceIds);
  if (drafts.length !== count) errors.push(`生成数が${count}件ではありません`);
  const sourceIds = new Set<string>();
  const normalizedBodies = new Set<string>();
  drafts.forEach((draft, index) => {
    const label = `投稿${index + 1}`;
    if (!draft.sourcePageId) errors.push(`${label}: sourcePageIdがありません`);
    if (allowedSourceIdSet.size > 0 && !allowedSourceIdSet.has(draft.sourcePageId)) {
      errors.push(`${label}: sourcePageIdが候補外です`);
    }
    if (sourceIds.has(draft.sourcePageId)) errors.push(`${label}: 同じ元台本が重複しています`);
    sourceIds.add(draft.sourcePageId);
    if (!draft.theme.trim()) errors.push(`${label}: テーマが空です`);
    const mainLength = contentLength(draft.mainText);
    const comment1Length = contentLength(draft.comment1);
    const comment2Length = contentLength(draft.comment2);
    if (!draft.mainText.trim()) errors.push(`${label}: メインが空です`);
    if (mainLength > 50) errors.push(`${label}: メインが${mainLength}文字です`);
    if (comment1Length < 370 || comment1Length > 500) errors.push(`${label}: コメント1が${comment1Length}文字です`);
    if (comment2Length < 370 || comment2Length > 500) errors.push(`${label}: コメント2が${comment2Length}文字です`);
    if (isGenerationRefusal(draft)) errors.push(`${label}: 元台本に基づく投稿ではなく生成不能の説明文になっています`);
    const normalized = normalizeForDuplicateCheck(`${draft.mainText}${draft.comment1}${draft.comment2}`);
    if (normalizedBodies.has(normalized)) errors.push(`${label}: 生成本文が別投稿と重複しています`);
    normalizedBodies.add(normalized);
  });
  return errors;
}

export async function generateYokoDraftBatch(count = 6): Promise<ThreadsContentDraft[]> {
  if (count !== 6) throw new Error('YOKO batch generation currently requires exactly 6 drafts');
  openAIKey();
  await ensureTables();
  const [scripts, knowledge, usedIds, corePages, existing] = await Promise.all([
    listYokoNotionSources({ sourceType: 'instagram_script', onlyUsable: true, limit: 1000 }),
    listYokoNotionSources({ sourceType: 'gem_knowledge', onlyUsable: true, limit: 1500 }),
    usedNotionPageIds(),
    getYokoNotionCorePages(),
    existingThreadsText(),
  ]);
  const candidates = selectYokoSources(scripts, usedIds, 12);
  if (candidates.length < count) {
    throw new Error(`生成可能な未使用台本が${candidates.length}件しかありません。Notion同期またはストック状態を確認してください。`);
  }
  const allowedSourceIds = candidates.map((source) => source.notion_page_id);
  const sourcePayload = candidates.map((script) => ({
    sourcePageId: script.notion_page_id,
    title: script.source_title,
    script: script.body_text,
    knowledge: relevantKnowledge(script, knowledge).map((item) => ({
      sourcePageId: item.notion_page_id,
      title: item.source_title,
      body: item.body_text,
    })),
  }));
  const normalizedExisting = existing.map(normalizeForDuplicateCheck).filter(Boolean);
  const model = process.env.OPENAI_DRAFT_MODEL || 'gpt-5.6-luna';
  const batchId = randomUUID();
  const generationInstructions = [
    corePages.generationPrompt.bodyText,
    'これは第1工程の内容確認用初稿です。本人文体への調整は行わないでください。',
    '候補から既存Threadsと意味が重複しない6件を選び、各元台本につき1投稿だけ作ってください。',
    '新規台本は最大1件です。新規台本が非重複なら優先し、残りは既存の未使用台本から選んでください。',
    'sourcePageIdは入力値を完全一致で返してください。',
    'この実行では、メインは最低文字数なし・最大50文字を最優先ルールとします。1行だけでも構いません。',
    'コメント1とコメント2は、空白・改行・全角空白を除外して各370〜500文字、狙いは420〜460文字とします。',
    '入力不足・作成不能・元台本の指定依頼など、システム向けの説明を投稿本文に書いてはいけません。必ず選んだsourcePageIdのscriptに基づく投稿を完成させてください。',
    '出力は指定されたJSONスキーマだけにしてください。',
  ].join('\n\n');
  const generationPrompt = JSON.stringify({
    task: '6件の内容確認用初稿を作成する',
    successCriteria: [
      '元台本の事実・中心主張・価値観を維持する',
      'メインは最大50文字、コメント1と2は各370〜500文字',
      'コメント1末尾とコメント2冒頭を接続する',
      '既存投稿と中心主張・説明事実・結論が重複する候補は選ばない',
    ],
    sources: sourcePayload,
    existingNormalizedTexts: normalizedExisting,
  });
  const result = await callOpenAI({
    model,
    schemaName: 'yoko_threads_drafts',
    schema: generationSchema(count, allowedSourceIds),
    instructions: generationInstructions,
    prompt: generationPrompt,
    verbosity: 'medium',
  });
  await recordUsage({ operation: 'draft_generation', model, usage: result.usage, batchId });
  let generated = (result.json as { drafts?: GeneratedDraft[] }).drafts || [];
  let validationErrors = validateGeneratedDrafts(generated, count, allowedSourceIds);
  const repairFailures: string[] = [];
  for (let attempt = 1; validationErrors.length && attempt <= MAX_GENERATION_REPAIR_ATTEMPTS; attempt += 1) {
    try {
      const repaired = await callOpenAI({
        model,
        schemaName: 'yoko_threads_drafts_repaired',
        schema: generationSchema(count, allowedSourceIds),
        instructions: `${generationInstructions}\n\n自動修正${attempt}/${MAX_GENERATION_REPAIR_ATTEMPTS}です。前回出力の品質エラーをすべて修正し、事実や中心主張は変えないでください。sourcePageIdは許可されたIDから変更しないでください。文字数は空白・改行・全角空白を除外して数え、コメント1・2を各420〜460文字に収めてください。文字数不足は元台本にある内容の具体化で補い、水増しや同じ説明の反復は禁止です。生成不能の説明文は、選択済みsourcePageIdのscriptに基づく完成稿へ置き換えてください。`,
        prompt: JSON.stringify({
          previousOutput: generated,
          validationErrors,
          allowedSourceIds,
          targetLengths: { mainText: '1〜50文字', comment1: '420〜460文字', comment2: '420〜460文字' },
        }),
        verbosity: 'medium',
      });
      await recordUsage({ operation: 'draft_repair', model, usage: repaired.usage, batchId });
      const repairedDrafts = (repaired.json as { drafts?: GeneratedDraft[] }).drafts || [];
      const repairedErrors = validateGeneratedDrafts(repairedDrafts, count, allowedSourceIds);
      const repairedHasStructuralError = repairedErrors.some((error) =>
        /生成数|sourcePageId|同じ元台本|テーマが空|生成本文が別投稿と重複/.test(error));
      if (!repairedHasStructuralError) {
        generated = repairedDrafts;
        validationErrors = repairedErrors;
      } else {
        repairFailures.push(`自動修正${attempt}回目の構造が不正でした`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '自動修正に失敗しました';
      repairFailures.push(`自動修正${attempt}回目のエラー: ${message}`);
    }
  }
  const structuralErrors = validationErrors.filter((error) =>
    /生成数|sourcePageId|同じ元台本|テーマが空|生成本文が別投稿と重複/.test(error));
  if (structuralErrors.length) throw new Error(`生成結果の構造チェックに失敗しました: ${structuralErrors.join(' / ')}`);
  const candidateById = new Map(candidates.map((source) => [source.notion_page_id, source]));
  const selected = generated.map((draft) => candidateById.get(draft.sourcePageId)).filter((source): source is YokoNotionSourceRecord => !!source);
  if (selected.length !== count) throw new Error('OpenAIが候補外の元台本を返しました');
  if (selected.filter((source) => source.source_origin === 'new').length > 1) throw new Error('新規台本が2件以上選ばれました');
  const generatedBySource = new Map(generated.map((draft) => [draft.sourcePageId, draft]));
  const generationWarnings = validationErrors.length ? [...validationErrors, ...repairFailures] : [];

  const now = new Date().toISOString();
  const draftRows = selected.map((source, index) => {
    const generatedDraft = generatedBySource.get(source.notion_page_id)!;
    return {
      draft_id: randomUUID(),
      batch_id: batchId,
      user_id: YOKO_ANALYCA_USER_ID,
      draft_number: index + 1,
      theme: generatedDraft.theme,
      main_text: generatedDraft.mainText,
      comment1: generatedDraft.comment1,
      comment2: generatedDraft.comment2,
      approved_main_text: null,
      approved_comment1: null,
      approved_comment2: null,
      status: 'review',
      line_message_id: null,
      schedule_id: null,
      thread_id: null,
      last_error: validationErrorsForDraft(validationErrors, index + 1).join(' / ') || null,
      created_at: now,
      updated_at: now,
    };
  });
  await client.dataset(DATASET).table(BATCH_TABLE).insert([{
    batch_id: batchId,
    user_id: YOKO_ANALYCA_USER_ID,
    status: generationWarnings.length ? 'generated_with_warnings' : 'generated',
    requested_count: count,
    created_count: count,
    created_by: 'analyca-ui',
    created_at: now,
    updated_at: now,
  }]);
  await client.query({
    query: `
      INSERT INTO \`${projectId}.${DATASET}.${DRAFT_TABLE}\` (
        draft_id, batch_id, user_id, draft_number, theme, main_text, comment1, comment2,
        approved_main_text, approved_comment1, approved_comment2, status,
        line_message_id, schedule_id, thread_id, last_error, created_at, updated_at
      )
      SELECT
        draft_id, batch_id, user_id, draft_number, theme, main_text, comment1, comment2,
        NULLIF(approved_main_text, ''), NULLIF(approved_comment1, ''), NULLIF(approved_comment2, ''), status,
        NULLIF(line_message_id, ''), NULLIF(schedule_id, ''), NULLIF(thread_id, ''), NULLIF(last_error, ''),
        TIMESTAMP(created_at), TIMESTAMP(updated_at)
      FROM UNNEST(@rows)
    `,
    params: {
      rows: draftRows.map((row) => ({
        ...row,
        approved_main_text: row.approved_main_text || '',
        approved_comment1: row.approved_comment1 || '',
        approved_comment2: row.approved_comment2 || '',
        line_message_id: row.line_message_id || '',
        schedule_id: row.schedule_id || '',
        thread_id: row.thread_id || '',
        last_error: row.last_error || '',
      })),
    },
  });
  const sourceRows: Array<Record<string, unknown>> = [];
  for (let index = 0; index < selected.length; index += 1) {
    const source = selected[index];
    const draftId = draftRows[index].draft_id;
    sourceRows.push({
      draft_id: draftId,
      user_id: YOKO_ANALYCA_USER_ID,
      notion_page_id: source.notion_page_id,
      source_type: source.source_type,
      source_role: 'primary',
      source_title: source.source_title,
      source_url: source.notion_url,
      source_body_text: source.body_text,
      source_content_hash: source.content_hash,
      created_at: now,
    });
    for (const item of relevantKnowledge(source, knowledge)) {
      sourceRows.push({
        draft_id: draftId,
        user_id: YOKO_ANALYCA_USER_ID,
        notion_page_id: item.notion_page_id,
        source_type: item.source_type,
        source_role: 'knowledge',
        source_title: item.source_title,
        source_url: item.notion_url,
        source_body_text: item.body_text,
        source_content_hash: item.content_hash,
        created_at: now,
      });
    }
    await markYokoNotionSourceGenerated({
      sourceType: 'instagram_script',
      notionPageId: source.notion_page_id,
      analycaDraftId: draftId,
    });
  }
  await client.dataset(DATASET).table(SOURCE_TABLE).insert(sourceRows);
  return (await listThreadsContentDrafts({ pageSize: count, batchId })).drafts;
}

export async function listThreadsContentDrafts(input: {
  status?: ThreadsContentStatus | 'all';
  search?: string;
  page?: number;
  pageSize?: number;
  batchId?: string;
} = {}): Promise<ThreadsContentListResult> {
  await ensureTables();
  const page = Math.max(input.page || 1, 1);
  const pageSize = Math.min(Math.max(input.pageSize || 24, 1), 100);
  const offset = (page - 1) * pageSize;
  const params = {
    userId: YOKO_ANALYCA_USER_ID,
    status: input.status && input.status !== 'all' ? input.status : '',
    search: input.search?.trim() || '',
    batchId: input.batchId || '',
  };
  const where = `
    user_id = @userId
    AND (@status = '' OR status = @status)
    AND (@batchId = '' OR batch_id = @batchId)
    AND (@search = '' OR LOWER(CONCAT(theme, ' ', main_text, ' ', comment1, ' ', comment2)) LIKE CONCAT('%', LOWER(@search), '%'))
  `;
  const [[countRow], rows, countRows, sourceRows, [usageRow]] = await Promise.all([
    client.query({ query: `SELECT COUNT(*) AS total FROM \`${projectId}.${DATASET}.${DRAFT_TABLE}\` WHERE ${where}`, params }).then(([result]) => result),
    client.query({
      query: `SELECT * FROM \`${projectId}.${DATASET}.${DRAFT_TABLE}\` WHERE ${where} ORDER BY created_at DESC, draft_number ASC LIMIT ${pageSize} OFFSET ${offset}`,
      params,
    }).then(([result]) => result),
    client.query({
      query: `SELECT status, COUNT(*) total FROM \`${projectId}.${DATASET}.${DRAFT_TABLE}\` WHERE user_id = @userId GROUP BY status`,
      params: { userId: YOKO_ANALYCA_USER_ID },
    }).then(([result]) => result),
    client.query({
      query: `SELECT source.* FROM \`${projectId}.${DATASET}.${SOURCE_TABLE}\` source JOIN \`${projectId}.${DATASET}.${DRAFT_TABLE}\` draft USING (draft_id) WHERE draft.user_id = @userId`,
      params: { userId: YOKO_ANALYCA_USER_ID },
    }).then(([result]) => result),
    client.query({
      query: `SELECT SUM(input_tokens) input_tokens, SUM(output_tokens) output_tokens, SUM(estimated_cost_usd) estimated_cost_usd FROM \`${projectId}.${DATASET}.${USAGE_TABLE}\` WHERE user_id = @userId`,
      params: { userId: YOKO_ANALYCA_USER_ID },
    }).then(([result]) => result),
  ]);
  const sourcesByDraft = new Map<string, ThreadsContentSource[]>();
  for (const row of sourceRows) {
    const draftId = plain(row.draft_id);
    const sources = sourcesByDraft.get(draftId) || [];
    sources.push({
      notionPageId: plain(row.notion_page_id),
      sourceType: plain(row.source_type) as ThreadsContentSource['sourceType'],
      role: plain(row.source_role) as ThreadsContentSource['role'],
      title: plain(row.source_title),
      url: plain(row.source_url),
      bodyText: plain(row.source_body_text),
    });
    sourcesByDraft.set(draftId, sources);
  }
  return {
    drafts: rows.map((row) => {
      const id = plain(row.draft_id);
      const approvedMain = plain(row.approved_main_text);
      const approvedComment1 = plain(row.approved_comment1);
      const approvedComment2 = plain(row.approved_comment2);
      return {
        id,
        batchId: plain(row.batch_id),
        number: integer(row.draft_number),
        theme: plain(row.theme),
        mainText: plain(row.main_text),
        comment1: plain(row.comment1),
        comment2: plain(row.comment2),
        status: plain(row.status) as ThreadsContentStatus,
        approvedSnapshot: approvedMain || approvedComment1 || approvedComment2
          ? { mainText: approvedMain, comment1: approvedComment1, comment2: approvedComment2 }
          : null,
        lineMessageId: plain(row.line_message_id) || null,
        scheduleId: plain(row.schedule_id) || null,
        threadId: plain(row.thread_id) || null,
        lastError: plain(row.last_error) || null,
        manualSavedAt: plain(row.manual_saved_at) || null,
        createdAt: plain(row.created_at),
        updatedAt: plain(row.updated_at),
        sources: sourcesByDraft.get(id) || [],
      };
    }),
    total: integer(countRow?.total),
    page,
    pageSize,
    usage: {
      inputTokens: integer(usageRow?.input_tokens),
      outputTokens: integer(usageRow?.output_tokens),
      estimatedCostUsd: usageRow?.estimated_cost_usd === null || usageRow?.estimated_cost_usd === undefined
        ? null
        : Number(plain(usageRow.estimated_cost_usd)),
    },
    counts: Object.fromEntries(countRows.map((row) => [plain(row.status), integer(row.total)])),
  };
}

const STATUS_TRANSITIONS: Record<ThreadsContentStatus, ThreadsContentStatus[]> = {
  review: ['approved', 'stock', 'discarded'],
  approved: ['review', 'style_review', 'stock', 'discarded'],
  style_review: ['review', 'ready', 'stock', 'discarded'],
  stock: ['review', 'approved', 'discarded'],
  discarded: ['stock', 'review', 'approved'],
  ready: ['style_review', 'stock', 'line_sent'],
  line_sent: ['ready'],
};

export function canTransitionThreadsContentStatus(from: ThreadsContentStatus, to: ThreadsContentStatus): boolean {
  return from === to || STATUS_TRANSITIONS[from].includes(to);
}

async function getDraft(draftId: string): Promise<ThreadsContentDraft> {
  const [rows] = await client.query({
    query: `SELECT * FROM \`${projectId}.${DATASET}.${DRAFT_TABLE}\` WHERE user_id = @userId AND draft_id = @draftId LIMIT 1`,
    params: { userId: YOKO_ANALYCA_USER_ID, draftId },
  });
  if (!rows[0]) throw new Error('投稿が見つかりません');
  const [sourceRows] = await client.query({
    query: `SELECT * FROM \`${projectId}.${DATASET}.${SOURCE_TABLE}\` WHERE user_id = @userId AND draft_id = @draftId`,
    params: { userId: YOKO_ANALYCA_USER_ID, draftId },
  });
  const row = rows[0];
  const approvedMain = plain(row.approved_main_text);
  const approvedComment1 = plain(row.approved_comment1);
  const approvedComment2 = plain(row.approved_comment2);
  const draft: ThreadsContentDraft = {
    id: plain(row.draft_id),
    batchId: plain(row.batch_id),
    number: integer(row.draft_number),
    theme: plain(row.theme),
    mainText: plain(row.main_text),
    comment1: plain(row.comment1),
    comment2: plain(row.comment2),
    status: plain(row.status) as ThreadsContentStatus,
    approvedSnapshot: approvedMain || approvedComment1 || approvedComment2
      ? { mainText: approvedMain, comment1: approvedComment1, comment2: approvedComment2 }
      : null,
    lineMessageId: plain(row.line_message_id) || null,
    scheduleId: plain(row.schedule_id) || null,
    threadId: plain(row.thread_id) || null,
    lastError: plain(row.last_error) || null,
    manualSavedAt: plain(row.manual_saved_at) || null,
    createdAt: plain(row.created_at),
    updatedAt: plain(row.updated_at),
    sources: sourceRows.map((source) => ({
      notionPageId: plain(source.notion_page_id),
      sourceType: plain(source.source_type) as ThreadsContentSource['sourceType'],
      role: plain(source.source_role) as ThreadsContentSource['role'],
      title: plain(source.source_title),
      url: plain(source.source_url),
      bodyText: plain(source.source_body_text),
    })),
  };
  return draft;
}

export async function updateThreadsContentDraft(input: {
  draftId: string;
  theme?: string;
  mainText?: string;
  comment1?: string;
  comment2?: string;
  status?: ThreadsContentStatus;
  markSaved?: boolean;
  preserveError?: boolean;
}): Promise<ThreadsContentDraft> {
  await ensureTables();
  const current = await getDraft(input.draftId);
  if (input.status && !canTransitionThreadsContentStatus(current.status, input.status)) {
    throw new Error(`${current.status}から${input.status}へは変更できません`);
  }
  const nextStatus = input.status || current.status;
  const takingApprovedSnapshot = current.status !== 'approved' && nextStatus === 'approved';
  await client.query({
    query: `
      UPDATE \`${projectId}.${DATASET}.${DRAFT_TABLE}\`
      SET theme = @theme,
        main_text = @mainText,
        comment1 = @comment1,
        comment2 = @comment2,
        status = @status,
        approved_main_text = IF(@takeSnapshot, @mainText, approved_main_text),
        approved_comment1 = IF(@takeSnapshot, @comment1, approved_comment1),
        approved_comment2 = IF(@takeSnapshot, @comment2, approved_comment2),
        manual_saved_at = IF(@markSaved, CURRENT_TIMESTAMP(), manual_saved_at),
        last_error = IF(@preserveError, last_error, NULL),
        updated_at = CURRENT_TIMESTAMP()
      WHERE user_id = @userId AND draft_id = @draftId
    `,
    params: {
      userId: YOKO_ANALYCA_USER_ID,
      draftId: input.draftId,
      theme: input.theme ?? current.theme,
      mainText: input.mainText ?? current.mainText,
      comment1: input.comment1 ?? current.comment1,
      comment2: input.comment2 ?? current.comment2,
      status: nextStatus,
      takeSnapshot: takingApprovedSnapshot,
      markSaved: input.markSaved === true,
      preserveError: input.preserveError === true,
    },
  });
  return getDraft(input.draftId);
}

function styleSchema(fields: ThreadsContentField[]): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['drafts'],
    properties: {
      drafts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['draftId', ...fields, 'voiceEvidenceIds'],
          properties: {
            draftId: { type: 'string' },
            ...(fields.includes('main_text') ? { main_text: { type: 'string' } } : {}),
            ...(fields.includes('comment1') ? { comment1: { type: 'string' } } : {}),
            ...(fields.includes('comment2') ? { comment2: { type: 'string' } } : {}),
            voiceEvidenceIds: {
              type: 'array',
              minItems: 3,
              maxItems: 6,
              items: { type: 'string' },
            },
          },
        },
      },
    },
  };
}

function styleAuditSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['drafts'],
    properties: {
      drafts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['draftId', 'contentPreserved', 'styleMatches', 'evidenceGrounded', 'issues'],
          properties: {
            draftId: { type: 'string' },
            contentPreserved: { type: 'boolean' },
            styleMatches: { type: 'boolean' },
            evidenceGrounded: { type: 'boolean' },
            issues: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  };
}

function characterNgrams(value: string, size = 3): Set<string> {
  const normalized = normalizeForDuplicateCheck(value);
  const grams = new Set<string>();
  for (let index = 0; index <= normalized.length - size; index += 1) {
    grams.add(normalized.slice(index, index + size));
  }
  return grams;
}

export function selectYokoVoiceEvidence(
  draft: Pick<ThreadsContentDraft, 'theme' | 'mainText' | 'comment1' | 'comment2' | 'approvedSnapshot' | 'sources'>,
  corpus: YokoVoiceEvidence[],
  limit = 6,
): YokoVoiceEvidence[] {
  const primary = draft.sources.find((source) => source.role === 'primary');
  const approved = currentStyleBaseline(draft);
  const queryGrams = characterNgrams([
    draft.theme,
    draft.mainText,
    approved.comment1,
    approved.comment2,
    primary?.title || '',
    primary?.bodyText || '',
  ].join('\n'));
  const ranked = corpus
    .map((item) => {
      const evidenceGrams = characterNgrams(`${item.parentText}\n${item.commentText}`);
      let overlap = 0;
      for (const gram of evidenceGrams) {
        if (queryGrams.has(gram)) overlap += 1;
      }
      return { item, score: overlap / Math.sqrt(Math.max(queryGrams.size * evidenceGrams.size, 1)) };
    })
    .sort((left, right) => right.score - left.score || right.item.createdAt.localeCompare(left.item.createdAt))
    .map(({ item }) => item);
  const selected: YokoVoiceEvidence[] = [];
  const seenTexts = new Set<string>();
  for (const item of ranked) {
    const normalized = normalizeForDuplicateCheck(item.commentText);
    if (seenTexts.has(normalized)) continue;
    seenTexts.add(normalized);
    selected.push(item);
    if (selected.length >= limit) break;
  }
  return selected;
}

export function currentStyleBaseline(
  draft: Pick<ThreadsContentDraft, 'mainText' | 'comment1' | 'comment2'>,
): Pick<ThreadsContentDraft, 'mainText' | 'comment1' | 'comment2'> {
  return {
    mainText: draft.mainText,
    comment1: draft.comment1,
    comment2: draft.comment2,
  };
}

export function styleAuditBaseline(
  draft: Pick<ThreadsContentDraft, 'mainText' | 'comment1' | 'comment2' | 'approvedSnapshot'>,
): Pick<ThreadsContentDraft, 'mainText' | 'comment1' | 'comment2'> {
  return draft.approvedSnapshot || currentStyleBaseline(draft);
}

export function hasStoredStyleAuditCandidate(lastError: string | null): boolean {
  return Boolean(lastError?.startsWith(STORED_STYLE_AUDIT_ERROR_PREFIX));
}

async function listYokoVoiceEvidence(): Promise<YokoVoiceEvidence[]> {
  const [rows] = await client.query({
    query: `
      SELECT
        c.comment_id AS evidence_id,
        c.parent_post_id,
        COALESCE(p.text, '') AS parent_text,
        c.text AS comment_text,
        c.permalink,
        c.timestamp AS created_at
      FROM \`${projectId}.${DATASET}.threads_comments\` c
      LEFT JOIN \`${projectId}.${DATASET}.threads_posts\` p
        ON p.user_id = c.user_id AND p.threads_id = c.parent_post_id
      WHERE c.user_id = @userId
        AND c.depth = 0
        AND CHAR_LENGTH(c.text) >= 150
      ORDER BY c.timestamp DESC
      LIMIT 500
    `,
    params: { userId: YOKO_ANALYCA_USER_ID },
  });
  return rows.map((row) => ({
    id: plain(row.evidence_id),
    parentPostId: plain(row.parent_post_id),
    parentText: plain(row.parent_text),
    commentText: plain(row.comment_text),
    permalink: plain(row.permalink),
    createdAt: plain(row.created_at),
  }));
}

export function applySelectedStyleFields(
  draft: Pick<ThreadsContentDraft, 'mainText' | 'comment1' | 'comment2'>,
  transformed: Record<string, string>,
  fields: ThreadsContentField[],
): Pick<ThreadsContentDraft, 'mainText' | 'comment1' | 'comment2'> {
  return {
    mainText: fields.includes('main_text') ? transformed.main_text : draft.mainText,
    comment1: fields.includes('comment1') ? transformed.comment1 : draft.comment1,
    comment2: fields.includes('comment2') ? transformed.comment2 : draft.comment2,
  };
}

function selectedStyleText(
  draft: Pick<ThreadsContentDraft, 'mainText' | 'comment1' | 'comment2'>,
  fields: ThreadsContentField[],
): Partial<Record<ThreadsContentField, string>> {
  return Object.fromEntries(fields.map((field) => [
    field,
    field === 'main_text' ? draft.mainText : draft[field],
  ]));
}

export function validateYokoStyleCandidate(
  draft: Pick<ThreadsContentDraft, 'comment1' | 'comment2'>,
): string[] {
  const combined = `${draft.comment1}\n${draft.comment2}`;
  const lines = combined.split('\n').map((line) => line.trim()).filter(Boolean);
  const commentLineCounts = [draft.comment1, draft.comment2].map((comment) => (
    comment.split('\n').map((line) => line.trim()).filter(Boolean).length
  ));
  const averageLineLength = lines.length
    ? lines.reduce((sum, line) => sum + Array.from(line).length, 0) / lines.length
    : 0;
  const shortLineRatio = lines.length
    ? lines.filter((line) => Array.from(line).length <= 24).length / lines.length
    : 0;
  const formalNegatives = combined.match(/ではありません|でもありません|わけではありません|必要はありません|限りません/g) || [];
  const issues: string[] = [];
  if (commentLineCounts.some((count) => count < 10)) {
    issues.push(`本人実文より改行が少なすぎます（コメント別${commentLineCounts.join('行・')}行）`);
  }
  if (averageLineLength > 38) issues.push(`1行が長く均一な説明文です（平均${averageLineLength.toFixed(1)}文字）`);
  if (shortLineRatio < 0.35) issues.push(`短い言い切りと間が不足しています（24文字以下${Math.round(shortLineRatio * 100)}%）`);
  if (formalNegatives.length > 0) issues.push(`硬い否定表現が${formalNegatives.length}回あります`);
  return issues;
}

async function setDraftStyleAuditError(
  draftId: string,
  message: string,
  candidate: Pick<ThreadsContentDraft, 'comment1' | 'comment2'>,
): Promise<ThreadsContentDraft> {
  await client.query({
    query: `
      UPDATE \`${projectId}.${DATASET}.${DRAFT_TABLE}\`
      SET comment1 = @comment1,
        comment2 = @comment2,
        last_error = @message,
        updated_at = CURRENT_TIMESTAMP()
      WHERE user_id = @userId AND draft_id = @draftId
    `,
    params: {
      userId: YOKO_ANALYCA_USER_ID,
      draftId,
      message,
      comment1: candidate.comment1,
      comment2: candidate.comment2,
    },
  });
  return getDraft(draftId);
}

async function syncApprovedStyleBaseline(draft: ThreadsContentDraft): Promise<ThreadsContentDraft> {
  await client.query({
    query: `
      UPDATE \`${projectId}.${DATASET}.${DRAFT_TABLE}\`
      SET approved_main_text = @mainText,
        approved_comment1 = @comment1,
        approved_comment2 = @comment2,
        updated_at = CURRENT_TIMESTAMP()
      WHERE user_id = @userId AND draft_id = @draftId
    `,
    params: {
      userId: YOKO_ANALYCA_USER_ID,
      draftId: draft.id,
      mainText: draft.mainText,
      comment1: draft.comment1,
      comment2: draft.comment2,
    },
  });
  return {
    ...draft,
    approvedSnapshot: currentStyleBaseline(draft),
  };
}

export async function styleYokoDrafts(input: {
  draftIds: string[];
  fields: ThreadsContentField[];
}): Promise<ThreadsContentDraft[]> {
  openAIKey();
  const fields = Array.from(new Set(input.fields)).filter((field) => field === 'comment1' || field === 'comment2');
  if (fields.length === 0) throw new Error('文体調整する欄を選んでください');
  const loadedDrafts = await Promise.all(input.draftIds.map(getDraft));
  if (loadedDrafts.some((draft) => draft.status !== 'approved')) throw new Error('採用済みの投稿だけ文体調整できます');
  const drafts = await Promise.all(loadedDrafts.map((draft) => (
    hasStoredStyleAuditCandidate(draft.lastError) ? draft : syncApprovedStyleBaseline(draft)
  )));
  const [corePages, voiceCorpus] = await Promise.all([
    getYokoNotionCorePages(),
    listYokoVoiceEvidence(),
  ]);
  const voiceByDraft = new Map(drafts.map((draft) => [draft.id, selectYokoVoiceEvidence(draft, voiceCorpus)]));
  const missingEvidence = drafts.filter((draft) => (voiceByDraft.get(draft.id)?.length || 0) < 3);
  if (missingEvidence.length) {
    throw new Error(`本人実文が3件未満の投稿があります: ${missingEvidence.map((draft) => `投稿${draft.number}`).join('、')}`);
  }
  const model = process.env.OPENAI_STYLE_MODEL || 'gpt-5.6-terra';
  const result = await callOpenAI({
    model,
    schemaName: 'yoko_style_transform',
    schema: styleSchema(fields),
    instructions: [
      corePages.styleGuide.bodyText,
      '文体ガイドの頻度表だけで文章を作らず、各投稿のvoiceEvidenceにあるYOKO本人の実文を最優先してください。',
      'voiceEvidenceから、驚き、事実説明、本音、反論、共感、判断、問いかけに近い実文を最低3件選び、その文の長短、改行、間、言い切りを移してください。',
      '最重要: 長い説明文を段落のまま残さないでください。承認稿の一文を意味の区切りで分け、1行1メッセージにします。各コメントは非空行10行以上、平均1行38文字以下、24文字以下の短い行を全体の35%以上にしてください。',
      '各コメントは370〜500文字を維持してください。短く切るために事実や結論を削らず、文を分けて改行してください。',
      '「〜という話ではありません」「〜でもありません」「〜わけではありません」「〜必要はありません」「〜とは限りません」のような硬い否定は禁止です。本人実文に合わせて「〜って話じゃないです」「〜って意味じゃないです」「〜でもないです」「〜必要はないです」「〜とは限らないです」のような会話調にしてください。',
      '「ただし」「一方で」「もちろん」を段落ごとに機械的に置く説明文は禁止です。必要な接続だけ残し、「でも」「逆に」「つまり」「だからこそ」や短い言い切りを、voiceEvidenceで実際に使われている範囲で使ってください。',
      '変換後に自分で、各コメントの非空行数、平均行長、24文字以下の行の割合、硬い否定表現0件を数えてから出力してください。条件を満たさない稿は出力しないでください。',
      'メイン投稿は工藤さんが編集済みです。メイン投稿は出力せず、一字も変更しないでください。',
      '承認済みコメントの事実・中心主張・論理の順序・結論・CTAは変更しないでください。',
      'primarySourceは文の長短、間、テンポの参考だけに使い、承認済みコメントにない自己開示・事実・主張・具体表現を持ち込まないでください。',
      '指定された欄だけ、YOKO本人の文体に整えてください。指定外の欄は出力しないでください。',
      '語尾だけの機械的置換は禁止です。元台本の感情の流れ、文の長短、間、言い切り、問いかけを使ってください。',
      '承認済み原文にない共感や断定を作る「ね」「よ」「なんです」などは追加しないでください。',
      'previousAuditErrorがある場合は、その指摘を繰り返さずに修正してください。',
      'voiceEvidenceIdsには実際に文体根拠として使用したvoiceEvidenceのidを3〜6件入れてください。',
      '出力は指定されたJSONスキーマだけにしてください。',
    ].join('\n\n'),
    prompt: JSON.stringify({
      fields,
      drafts: drafts.map((draft) => ({
        draftId: draft.id,
        approved: currentStyleBaseline(draft),
        previousAuditError: draft.lastError,
        primarySource: draft.sources.find((source) => source.role === 'primary') || null,
        voiceEvidence: voiceByDraft.get(draft.id),
      })),
    }),
  });
  type StyleTransformRow = {
    draftId: string;
    main_text?: string;
    comment1?: string;
    comment2?: string;
    voiceEvidenceIds: string[];
  };
  const transformed = (result.json as { drafts?: StyleTransformRow[] }).drafts || [];
  const byId = new Map(transformed.map((item) => [item.draftId, item]));
  const projected = drafts.map((draft) => {
    const item = byId.get(draft.id);
    if (!item) throw new Error(`OpenAI omitted draft ${draft.id}`);
    const allowedEvidenceIds = new Set((voiceByDraft.get(draft.id) || []).map((evidence) => evidence.id));
    const usedEvidenceIds = Array.from(new Set(item.voiceEvidenceIds));
    if (usedEvidenceIds.length < 3 || usedEvidenceIds.some((id) => !allowedEvidenceIds.has(id))) {
      throw new Error(`投稿${draft.number}: 本人実文の根拠IDが不足または不正です`);
    }
    return {
      draftId: draft.id,
      ...applySelectedStyleFields(draft, {
        main_text: item.main_text || '',
        comment1: item.comment1 || '',
        comment2: item.comment2 || '',
      }, fields),
      voiceEvidenceIds: usedEvidenceIds,
    };
  });
  const deterministicIssuesById = new Map(projected.map((draft) => [
    draft.draftId,
    validateYokoStyleCandidate(draft),
  ]));
  await recordUsage({ operation: 'style_transform', model, usage: result.usage, batchId: drafts[0]?.batchId });

  const auditModel = process.env.OPENAI_AUDIT_MODEL || 'gpt-5.6-luna';
  const audit = await callOpenAI({
    model: auditModel,
    schemaName: 'yoko_style_audit',
    schema: styleAuditSchema(),
    instructions: [
      corePages.styleGuide.bodyText,
      'あなたは文体変換を実行した担当とは別の監査者です。修正はせず、合否だけを判定してください。',
      '文体ガイドの頻度ではなく、voiceEvidenceの本人実文と変換稿を直接比較してください。',
      '監査対象はselectedFieldsにあるコメント欄だけです。メイン投稿は監査対象外です。',
      'contentPreservedは内容保持だけの判定です。事実・数値・主体・時期・頻度・本人属性・中心主張・結論・CTAが追加、削除、変更された場合だけfalseにしてください。',
      '句読点、かぎ括弧、改行、文の分割、接続詞、語尾、言い切り方の変更は文体調整の目的そのものです。意味と論理の順序が同じならcontentPreservedをfalseにしないでください。',
      'styleMatchesは本人文体だけの判定です。元台本の感情の流れ、文の長短、間、言い切り、問いかけが本人実文に沿うか確認してください。',
      'evidenceGroundedは、usedVoiceEvidenceIdsで指定された最低3件の実文から、改行、呼吸、文の長短、言い切りの具体的な根拠が確認できる場合だけtrueにしてください。IDを列挙しただけならfalseです。',
      'primarySourceの自己開示や固有表現が承認稿にない場合、それを追加していないことをstyleMatchesの不合格理由にしてはいけません。承認稿にある内容だけで作れるリズムとテンポを評価してください。',
      '語尾だけの機械的置換、均一なテンポ、本人根拠のない「ね」「よ」「なんです」などの追加があればstyleMatchesをfalseにしてください。',
      '各コメントが非空行10行以上、平均1行38文字以下、24文字以下の短い行35%以上、硬い否定表現0件を満たさない場合はstyleMatchesをfalseにしてください。',
      '短い改行は本人実文に実在する文体要素です。deterministicIssuesが空なら、短く改行されていること自体や短い行が多いことだけを理由にstyleMatchesをfalseにしないでください。意味が途中で切れて不自然な箇所がある場合だけ、その箇所を引用して不合格にしてください。',
      '「テンポが均一」「細切れ」のような抽象的理由だけで不合格にしないでください。本人実文との差を示す変換稿の具体的な一節をissuesへ必ず引用してください。',
      'issuesにはcontentPreservedまたはstyleMatchesをfalseにした具体的理由だけを書いてください。単なる表現差はissuesに書かないでください。',
      '出力は指定されたJSONスキーマだけにしてください。',
    ].join('\n\n'),
    prompt: JSON.stringify({
      selectedFields: fields,
      drafts: drafts.map((draft, index) => ({
        draftId: draft.id,
        approved: selectedStyleText(styleAuditBaseline(draft), fields),
        transformed: selectedStyleText(projected[index], fields),
        primarySource: draft.sources.find((source) => source.role === 'primary') || null,
        usedVoiceEvidenceIds: projected[index].voiceEvidenceIds,
        voiceEvidence: voiceByDraft.get(draft.id),
        deterministicIssues: deterministicIssuesById.get(draft.id),
      })),
    }),
  });
  await recordUsage({ operation: 'style_audit', model: auditModel, usage: audit.usage, batchId: drafts[0]?.batchId });
  const auditRows = (audit.json as { drafts?: Array<{ draftId: string; contentPreserved: boolean; styleMatches: boolean; evidenceGrounded: boolean; issues: string[] }> }).drafts || [];
  const auditById = new Map(auditRows.map((item) => [item.draftId, item]));
  const updated: ThreadsContentDraft[] = [];
  for (let index = 0; index < drafts.length; index += 1) {
    const draft = drafts[index];
    const item = projected[index];
    const auditItem = auditById.get(draft.id);
    const deterministicIssues = deterministicIssuesById.get(draft.id) || [];
    if (deterministicIssues.length || !auditItem?.contentPreserved || !auditItem.styleMatches || !auditItem.evidenceGrounded) {
      const issues = [...deterministicIssues, ...(auditItem?.issues || [])].join('、') || '監査結果がありません';
      updated.push(await setDraftStyleAuditError(draft.id, `${STORED_STYLE_AUDIT_ERROR_PREFIX} ${issues}`, item));
      continue;
    }
    updated.push(await updateThreadsContentDraft({
      draftId: draft.id,
      comment1: item.comment1,
      comment2: item.comment2,
      status: 'style_review',
    }));
  }
  return updated;
}

export function isDraftReadyForLine(draft: Pick<ThreadsContentDraft, 'status' | 'lineMessageId' | 'scheduleId' | 'threadId'>) {
  return draft.status === 'ready' && !draft.lineMessageId && !draft.scheduleId && !draft.threadId;
}

export async function getReadyDraftsForLine(draftIds?: string[]): Promise<ThreadsContentDraft[]> {
  const result = await listThreadsContentDrafts({ status: 'ready', pageSize: 100 });
  const eligible = result.drafts.filter(isDraftReadyForLine);
  if (!draftIds?.length) return eligible;
  const requested = new Set(draftIds);
  const selected = eligible.filter((draft) => requested.has(draft.id));
  if (selected.length !== requested.size) {
    throw new Error('完成前、LINE送信済み、予約済み、または公開済みの投稿が含まれています');
  }
  return selected;
}

export async function linkThreadsContentDraftDelivery(input: {
  draftId: string;
  scheduleId: string;
  lineMessageId: string;
}): Promise<ThreadsContentDraft> {
  await client.query({
    query: `
      UPDATE \`${projectId}.${DATASET}.${DRAFT_TABLE}\`
      SET schedule_id = @scheduleId,
        line_message_id = @lineMessageId,
        status = 'line_sent',
        last_error = NULL,
        updated_at = CURRENT_TIMESTAMP()
      WHERE user_id = @userId
        AND draft_id = @draftId
        AND status = 'ready'
        AND schedule_id IS NULL
        AND line_message_id IS NULL
        AND thread_id IS NULL
    `,
    params: {
      userId: YOKO_ANALYCA_USER_ID,
      draftId: input.draftId,
      scheduleId: input.scheduleId,
      lineMessageId: input.lineMessageId,
    },
  });
  const updated = await getDraft(input.draftId);
  if (updated.status !== 'line_sent'
    || updated.scheduleId !== input.scheduleId
    || updated.lineMessageId !== input.lineMessageId) {
    throw new Error(`投稿${updated.number}のLINE送信結果を保存できませんでした`);
  }
  return updated;
}
