import { BigQuery } from '@google-cloud/bigquery';
import type { YokoNotionPageContent } from '@/lib/yoko-notion';

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID;
const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS || '{}';
const DATASET = 'analyca';
const TABLE = 'yoko_notion_source_ledger';
export const YOKO_ANALYCA_USER_ID = '33833959932919231';

export type YokoNotionSourceType = 'instagram_script' | 'gem_knowledge';
export type YokoNotionChangeType = 'baseline' | 'new' | 'updated' | 'unchanged' | 'removed';

type LedgerRow = {
  notion_page_id: string;
  source_type: YokoNotionSourceType;
  content_hash: string;
  notion_last_edited_time: string;
  generation_status: string;
  analyca_draft_id: string | null;
  source_title: string;
  body_text: string;
  properties_json: string;
  source_origin: 'baseline' | 'new';
};

export type YokoNotionSourceRecord = LedgerRow & {
  notion_url: string;
  notion_created_time: string;
  last_change_type: YokoNotionChangeType;
  archived: boolean;
};

export type YokoNotionSyncSummary = {
  sourceType: YokoNotionSourceType;
  total: number;
  baseline: number;
  new: number;
  updated: number;
  unchanged: number;
  removed: number;
};

export function classifyYokoNotionChange(input: {
  previousHash?: string;
  currentHash: string;
  initialBaseline: boolean;
}): Exclude<YokoNotionChangeType, 'removed'> {
  if (!input.previousHash) return input.initialBaseline ? 'baseline' : 'new';
  return input.previousHash === input.currentHash ? 'unchanged' : 'updated';
}

function parseCredentials(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

const client = new BigQuery({ projectId, credentials: parseCredentials(credentialsJson) });

const SCHEMA = [
  { name: 'analyca_user_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'notion_page_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'source_type', type: 'STRING', mode: 'REQUIRED' },
  { name: 'notion_url', type: 'STRING', mode: 'REQUIRED' },
  { name: 'notion_created_time', type: 'TIMESTAMP', mode: 'REQUIRED' },
  { name: 'notion_last_edited_time', type: 'TIMESTAMP', mode: 'REQUIRED' },
  { name: 'content_hash', type: 'STRING', mode: 'REQUIRED' },
  { name: 'generation_status', type: 'STRING', mode: 'REQUIRED' },
  { name: 'analyca_draft_id', type: 'STRING', mode: 'NULLABLE' },
  { name: 'last_change_type', type: 'STRING', mode: 'REQUIRED' },
  { name: 'archived', type: 'BOOLEAN', mode: 'REQUIRED' },
  { name: 'first_seen_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
  { name: 'last_seen_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
  { name: 'synced_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
  { name: 'source_title', type: 'STRING', mode: 'NULLABLE' },
  { name: 'body_text', type: 'STRING', mode: 'NULLABLE' },
  { name: 'properties_json', type: 'STRING', mode: 'NULLABLE' },
  { name: 'source_origin', type: 'STRING', mode: 'NULLABLE' },
];

let ensureTablePromise: Promise<void> | null = null;

async function ensureTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      const table = client.dataset(DATASET).table(TABLE);
      const [exists] = await table.exists();
      if (!exists) {
        try {
          await client.dataset(DATASET).createTable(TABLE, { schema: SCHEMA });
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (!message.includes('Already Exists')) throw error;
        }
      }
      await client.query({
        query: `
          ALTER TABLE \`${projectId}.${DATASET}.${TABLE}\` ADD COLUMN IF NOT EXISTS source_title STRING;
          ALTER TABLE \`${projectId}.${DATASET}.${TABLE}\` ADD COLUMN IF NOT EXISTS body_text STRING;
          ALTER TABLE \`${projectId}.${DATASET}.${TABLE}\` ADD COLUMN IF NOT EXISTS properties_json STRING;
          ALTER TABLE \`${projectId}.${DATASET}.${TABLE}\` ADD COLUMN IF NOT EXISTS source_origin STRING
        `,
      });
    })().catch((error) => {
      ensureTablePromise = null;
      throw error;
    });
  }
  return ensureTablePromise;
}

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'value' in value) {
    return String((value as { value?: unknown }).value || '');
  }
  return String(value || '');
}

export async function getYokoNotionLedgerRows(sourceType: YokoNotionSourceType): Promise<LedgerRow[]> {
  await ensureTable();
  const [rows] = await client.query({
    query: `
      SELECT notion_page_id, source_type, content_hash, notion_last_edited_time,
        generation_status, analyca_draft_id, source_title, body_text,
        properties_json, source_origin
      FROM \`${projectId}.${DATASET}.${TABLE}\`
      WHERE analyca_user_id = @userId AND source_type = @sourceType
    `,
    params: { userId: YOKO_ANALYCA_USER_ID, sourceType },
  });
  return rows.map((row) => ({
    notion_page_id: text(row.notion_page_id),
    source_type: sourceType,
    content_hash: text(row.content_hash),
    notion_last_edited_time: text(row.notion_last_edited_time),
    generation_status: text(row.generation_status) || 'unprocessed',
    analyca_draft_id: text(row.analyca_draft_id) || null,
    source_title: text(row.source_title),
    body_text: text(row.body_text),
    properties_json: text(row.properties_json) || '{}',
    source_origin: text(row.source_origin) === 'new' ? 'new' : 'baseline',
  }));
}

function sourceTitle(entry: YokoNotionPageContent): string {
  const preferred = entry.properties['台本'] ?? entry.properties['知識']
    ?? entry.properties.Name ?? entry.properties.name ?? entry.properties.title;
  if (typeof preferred === 'string' && preferred.trim()) return preferred.trim();
  const firstString = Object.values(entry.properties)
    .find((value) => typeof value === 'string' && value.trim());
  return typeof firstString === 'string' ? firstString.trim() : 'タイトルなし';
}

export async function syncYokoNotionLedger(
  sourceType: YokoNotionSourceType,
  entries: YokoNotionPageContent[],
  options: { completeSnapshot?: boolean } = {},
): Promise<YokoNotionSyncSummary> {
  const previousRows = await getYokoNotionLedgerRows(sourceType);
  const previousById = new Map(previousRows.map((row) => [row.notion_page_id, row]));
  const initialBaseline = previousRows.length === 0;
  const now = new Date().toISOString();
  const counts: Record<YokoNotionChangeType, number> = { baseline: 0, new: 0, updated: 0, unchanged: 0, removed: 0 };

  const rows = entries.map((entry) => {
    const previous = previousById.get(entry.id);
    const changeType = classifyYokoNotionChange({
      previousHash: previous?.content_hash,
      currentHash: entry.contentHash,
      initialBaseline,
    });
    counts[changeType] += 1;

    const previousStatus = previous?.generation_status || 'unprocessed';
    const generationStatus = changeType === 'updated' && ['generated', 'draft_saved'].includes(previousStatus)
      ? 'needs_regeneration'
      : previousStatus;

    return {
      analyca_user_id: YOKO_ANALYCA_USER_ID,
      notion_page_id: entry.id,
      source_type: sourceType,
      notion_url: entry.url,
      notion_created_time: entry.createdTime,
      notion_last_edited_time: entry.lastEditedTime,
      content_hash: entry.contentHash,
      generation_status: generationStatus,
      analyca_draft_id: previous?.analyca_draft_id || '',
      last_change_type: changeType,
      source_title: sourceTitle(entry),
      body_text: entry.bodyText,
      properties_json: JSON.stringify(entry.properties),
      source_origin: previous?.source_origin || (changeType === 'new' ? 'new' : 'baseline'),
      archived: false,
      first_seen_at: now,
      last_seen_at: now,
      synced_at: now,
    };
  });

  if (rows.length > 0) {
    await client.query({
      query: `
        MERGE \`${projectId}.${DATASET}.${TABLE}\` target
        USING UNNEST(@rows) source
        ON target.analyca_user_id = source.analyca_user_id
          AND target.notion_page_id = source.notion_page_id
          AND target.source_type = source.source_type
        WHEN MATCHED THEN UPDATE SET
          notion_url = source.notion_url,
          notion_created_time = TIMESTAMP(source.notion_created_time),
          notion_last_edited_time = TIMESTAMP(source.notion_last_edited_time),
          content_hash = source.content_hash,
          generation_status = source.generation_status,
          analyca_draft_id = NULLIF(source.analyca_draft_id, ''),
          last_change_type = source.last_change_type,
          source_title = source.source_title,
          body_text = IF(source.body_text = '', target.body_text, source.body_text),
          properties_json = IF(source.properties_json = '{}', target.properties_json, source.properties_json),
          source_origin = COALESCE(target.source_origin, source.source_origin),
          archived = source.archived,
          last_seen_at = TIMESTAMP(source.last_seen_at),
          synced_at = TIMESTAMP(source.synced_at)
        WHEN NOT MATCHED THEN INSERT (
          analyca_user_id, notion_page_id, source_type, notion_url,
          notion_created_time, notion_last_edited_time, content_hash,
          generation_status, analyca_draft_id, last_change_type, archived,
          first_seen_at, last_seen_at, synced_at, source_title, body_text,
          properties_json, source_origin
        ) VALUES (
          source.analyca_user_id, source.notion_page_id, source.source_type, source.notion_url,
          TIMESTAMP(source.notion_created_time), TIMESTAMP(source.notion_last_edited_time), source.content_hash,
          source.generation_status, NULLIF(source.analyca_draft_id, ''), source.last_change_type, source.archived,
          TIMESTAMP(source.first_seen_at), TIMESTAMP(source.last_seen_at), TIMESTAMP(source.synced_at),
          source.source_title, source.body_text, source.properties_json, source.source_origin
        )
      `,
      params: { rows },
    });
  }

  const seenIds = entries.map((entry) => entry.id);
  const removedIds = options.completeSnapshot === false
    ? []
    : previousRows
      .map((row) => row.notion_page_id)
      .filter((pageId) => !seenIds.includes(pageId));
  counts.removed = removedIds.length;
  if (removedIds.length > 0) {
    await client.query({
      query: `
        UPDATE \`${projectId}.${DATASET}.${TABLE}\`
        SET archived = TRUE, last_change_type = 'removed', synced_at = CURRENT_TIMESTAMP()
        WHERE analyca_user_id = @userId
          AND source_type = @sourceType
          AND notion_page_id IN UNNEST(@removedIds)
      `,
      params: { userId: YOKO_ANALYCA_USER_ID, sourceType, removedIds },
    });
  }

  return {
    sourceType,
    total: entries.length,
    baseline: counts.baseline,
    new: counts.new,
    updated: counts.updated,
    unchanged: counts.unchanged,
    removed: counts.removed,
  };
}

export async function listYokoNotionSources(input: {
  sourceType?: YokoNotionSourceType;
  onlyUsable?: boolean;
  limit?: number;
} = {}): Promise<YokoNotionSourceRecord[]> {
  await ensureTable();
  const limit = Math.min(Math.max(input.limit || 1000, 1), 2000);
  const [rows] = await client.query({
    query: `
      SELECT notion_page_id, source_type, notion_url, notion_created_time,
        notion_last_edited_time, content_hash, generation_status,
        analyca_draft_id, last_change_type, archived, source_title,
        body_text, properties_json, source_origin
      FROM \`${projectId}.${DATASET}.${TABLE}\`
      WHERE analyca_user_id = @userId
        AND (@sourceType = '' OR source_type = @sourceType)
        AND (@onlyUsable = FALSE OR (archived = FALSE AND body_text IS NOT NULL AND body_text != ''))
      ORDER BY notion_last_edited_time DESC
      LIMIT ${limit}
    `,
    params: {
      userId: YOKO_ANALYCA_USER_ID,
      sourceType: input.sourceType || '',
      onlyUsable: input.onlyUsable ?? false,
    },
  });
  return rows.map((row) => ({
    notion_page_id: text(row.notion_page_id),
    source_type: text(row.source_type) as YokoNotionSourceType,
    notion_url: text(row.notion_url),
    notion_created_time: text(row.notion_created_time),
    notion_last_edited_time: text(row.notion_last_edited_time),
    content_hash: text(row.content_hash),
    generation_status: text(row.generation_status) || 'unprocessed',
    analyca_draft_id: text(row.analyca_draft_id) || null,
    last_change_type: (text(row.last_change_type) || 'unchanged') as YokoNotionChangeType,
    archived: Boolean(row.archived),
    source_title: text(row.source_title) || 'タイトルなし',
    body_text: text(row.body_text),
    properties_json: text(row.properties_json) || '{}',
    source_origin: text(row.source_origin) === 'new' ? 'new' : 'baseline',
  }));
}

export async function markYokoNotionSourceGenerated(input: {
  sourceType: YokoNotionSourceType;
  notionPageId: string;
  analycaDraftId: string;
}) {
  await ensureTable();
  await client.query({
    query: `
      UPDATE \`${projectId}.${DATASET}.${TABLE}\`
      SET generation_status = 'draft_saved', analyca_draft_id = @draftId, synced_at = CURRENT_TIMESTAMP()
      WHERE analyca_user_id = @userId
        AND source_type = @sourceType
        AND notion_page_id = @pageId
    `,
    params: {
      userId: YOKO_ANALYCA_USER_ID,
      sourceType: input.sourceType,
      pageId: input.notionPageId,
      draftId: input.analycaDraftId,
    },
  });
}
