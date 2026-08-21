import { createHash } from 'node:crypto';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2026-03-11';
const REQUEST_INTERVAL_MS = 350;
const MAX_RETRIES = 4;
const MAX_BLOCK_DEPTH = 50;

export const YOKO_NOTION_IDS = {
  startHere: '3b18d6b5d1fa81888be9fce6944906c0',
  styleGuide: '3b08d6b5d1fa8129862dc505e4dcd32b',
  generationPrompt: '3b18d6b5d1fa81d6ade7da9cdafc6226',
  instagramScripts: '7897261f-9533-4fd5-add3-46245f5b608c',
  gemKnowledge: '5a384382-edce-4887-bb45-4f81a4c57444',
} as const;

const YOKO_NOTION_SOURCES = [
  { key: 'startHere', label: 'START HERE', path: `/pages/${YOKO_NOTION_IDS.startHere}` },
  { key: 'styleGuide', label: 'YOKO文体ガイド', path: `/pages/${YOKO_NOTION_IDS.styleGuide}` },
  { key: 'generationPrompt', label: 'YOKO用Threads投稿生成プロンプト', path: `/pages/${YOKO_NOTION_IDS.generationPrompt}` },
  { key: 'instagramScripts', label: 'Instagram台本・実績対応DB', path: `/data_sources/${YOKO_NOTION_IDS.instagramScripts}` },
  { key: 'gemKnowledge', label: '宝石ノウハウDB', path: `/data_sources/${YOKO_NOTION_IDS.gemKnowledge}` },
] as const;

type NotionList<T> = {
  object: 'list';
  results: T[];
  has_more: boolean;
  next_cursor: string | null;
};

type NotionRichText = {
  plain_text?: string;
  href?: string | null;
};

type NotionPage = {
  object: 'page';
  id: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  archived?: boolean;
  in_trash?: boolean;
  properties: Record<string, NotionProperty>;
};

type NotionProperty = {
  id?: string;
  type?: string;
  [key: string]: unknown;
};

type NotionBlock = {
  object: 'block';
  id: string;
  type: string;
  has_children: boolean;
  [key: string]: unknown;
};

export type YokoNotionSourceStatus = {
  key: (typeof YOKO_NOTION_SOURCES)[number]['key'];
  label: string;
  accessible: boolean;
};

export type YokoNotionConnectionStatus = {
  connected: boolean;
  sources: YokoNotionSourceStatus[];
};

export type YokoNotionPageContent = {
  id: string;
  url: string;
  createdTime: string;
  lastEditedTime: string;
  properties: Record<string, unknown>;
  bodyText: string;
  blockCount: number;
  contentHash: string;
};

export type YokoNotionPageIndex = Omit<YokoNotionPageContent, 'bodyText' | 'blockCount' | 'contentHash'>;

export type YokoNotionHydrationOptions = {
  followSourcePage?: boolean;
  propertyBodyFields?: string[];
};

export type YokoNotionCorpus = {
  corePages: {
    startHere: YokoNotionPageContent;
    styleGuide: YokoNotionPageContent;
    generationPrompt: YokoNotionPageContent;
  };
  instagramScripts: YokoNotionPageContent[];
  gemKnowledge: YokoNotionPageContent[];
};

let requestQueue: Promise<void> = Promise.resolve();
let nextRequestAt = 0;

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function scheduleRequest<T>(request: () => Promise<T>): Promise<T> {
  let releaseQueue: () => void = () => undefined;
  const previous = requestQueue;
  requestQueue = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });

  await previous;
  const delay = Math.max(0, nextRequestAt - Date.now());
  if (delay > 0) await wait(delay);
  nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;

  try {
    return await request();
  } finally {
    releaseQueue();
  }
}

function notionToken() {
  const token = process.env.NOTION_API_TOKEN;
  if (!token) throw new Error('NOTION_API_TOKEN is not configured');
  return token;
}

async function notionRequest<T>(path: string, init?: RequestInit): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await scheduleRequest(() => fetch(`${NOTION_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${notionToken()}`,
        'Notion-Version': NOTION_VERSION,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
      cache: 'no-store',
    }));

    if (response.ok) return response.json() as Promise<T>;

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === MAX_RETRIES) {
      const detail = await response.text();
      throw new Error(`Notion API request failed: ${response.status} ${detail.slice(0, 300)}`);
    }

    const retryAfterSeconds = Number(response.headers.get('retry-after') || 0);
    await wait(Math.max(retryAfterSeconds * 1000, 500 * (attempt + 1)));
  }

  throw new Error('Notion API request failed after retries');
}

async function retrieveAllBlockChildren(blockId: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | null = null;

  do {
    const query = new URLSearchParams({ page_size: '100' });
    if (cursor) query.set('start_cursor', cursor);
    const response: NotionList<NotionBlock> = await notionRequest(`/blocks/${blockId}/children?${query}`);
    blocks.push(...response.results);
    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);

  return blocks;
}

function richText(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value.map((item) => {
    if (!item || typeof item !== 'object') return '';
    return String((item as NotionRichText).plain_text || '');
  }).join('');
}

function blockText(block: NotionBlock): string {
  const value = block[block.type];
  if (!value || typeof value !== 'object') return '';
  const data = value as Record<string, unknown>;

  const text = richText(data.rich_text) || richText(data.caption) || richText(data.title);
  if (text) return text;
  if (typeof data.title === 'string') return data.title;
  if (typeof data.url === 'string') return data.url;
  if (block.type === 'divider') return '---';
  return '';
}

async function retrieveBlocksRecursively(
  blockId: string,
  depth = 0,
): Promise<Array<{ block: NotionBlock; depth: number }>> {
  if (depth > MAX_BLOCK_DEPTH) {
    throw new Error(`Notion block depth exceeded ${MAX_BLOCK_DEPTH}`);
  }

  const children = await retrieveAllBlockChildren(blockId);
  const result: Array<{ block: NotionBlock; depth: number }> = [];

  for (const block of children) {
    result.push({ block, depth });
    if (block.has_children) {
      result.push(...await retrieveBlocksRecursively(block.id, depth + 1));
    }
  }

  return result;
}

function normalizeProperty(property: NotionProperty): unknown {
  const type = property.type;
  if (!type) return null;
  const value = property[type];

  if (type === 'title' || type === 'rich_text') return richText(value);
  if (type === 'number' || type === 'checkbox' || type === 'url' || type === 'email' || type === 'phone_number') {
    return value ?? null;
  }
  if (type === 'select' || type === 'status') {
    return value && typeof value === 'object' ? (value as { name?: string }).name || null : null;
  }
  if (type === 'multi_select' && Array.isArray(value)) {
    return value.map((item) => (item as { name?: string }).name || '').filter(Boolean);
  }
  if (type === 'date') return value || null;
  if (type === 'created_time' || type === 'last_edited_time') return value || null;
  if (type === 'relation' && Array.isArray(value)) {
    return value.map((item) => (item as { id?: string }).id || '').filter(Boolean);
  }
  if (type === 'people' && Array.isArray(value)) {
    return value.map((item) => {
      const person = item as { id?: string; name?: string };
      return person.name || person.id || '';
    }).filter(Boolean);
  }
  if (type === 'files' && Array.isArray(value)) {
    return value.map((item) => {
      const file = item as { name?: string; file?: { url?: string }; external?: { url?: string } };
      return { name: file.name || '', url: file.file?.url || file.external?.url || '' };
    });
  }
  if (type === 'formula' && value && typeof value === 'object') {
    const formula = value as Record<string, unknown>;
    return formula[typeof formula.type === 'string' ? formula.type : ''] ?? formula;
  }
  if (type === 'rollup') return value ?? null;
  if (type === 'unique_id') return value ?? null;
  return value ?? null;
}

function normalizeProperties(properties: Record<string, NotionProperty>) {
  return Object.fromEntries(Object.entries(properties).map(([name, property]) => [name, normalizeProperty(property)]));
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]),
  );
}

function hashContent(properties: Record<string, unknown>, bodyText: string) {
  const canonical = JSON.stringify(stableValue({ properties, bodyText }));
  return createHash('sha256').update(canonical).digest('hex');
}

function notionPageIdFromUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const compactId = value.match(/([0-9a-f]{32})(?:[?#/]|$)/i)?.[1];
  if (!compactId) return null;
  return [
    compactId.slice(0, 8),
    compactId.slice(8, 12),
    compactId.slice(12, 16),
    compactId.slice(16, 20),
    compactId.slice(20),
  ].join('-');
}

function propertyBodyText(properties: Record<string, unknown>, fields: string[]): string {
  return fields.flatMap((field) => {
    const value = properties[field];
    if (value === null || value === undefined || value === '') return [];
    const rendered = Array.isArray(value)
      ? value.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join('、')
      : typeof value === 'string' ? value : JSON.stringify(value);
    return rendered ? [`${field}：${rendered}`] : [];
  }).join('\n');
}

function pageIndex(page: NotionPage): YokoNotionPageIndex {
  return {
    id: page.id,
    url: page.url,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
    properties: normalizeProperties(page.properties),
  };
}

export async function hydrateYokoNotionPage(
  index: YokoNotionPageIndex,
  options: YokoNotionHydrationOptions = {},
): Promise<YokoNotionPageContent> {
  let nestedBlocks = await retrieveBlocksRecursively(index.id);
  let blockBodyText = nestedBlocks
    .map(({ block, depth }) => {
      const text = blockText(block);
      return text ? `${'  '.repeat(depth)}${text}` : '';
    })
    .filter(Boolean)
    .join('\n');

  if (!blockBodyText && options.followSourcePage) {
    const sourcePageId = notionPageIdFromUrl(index.properties['元台本']);
    if (sourcePageId && sourcePageId !== index.id) {
      nestedBlocks = await retrieveBlocksRecursively(sourcePageId);
      blockBodyText = nestedBlocks
        .map(({ block, depth }) => {
          const text = blockText(block);
          return text ? `${'  '.repeat(depth)}${text}` : '';
        })
        .filter(Boolean)
        .join('\n');
    }
  }

  const propertiesText = propertyBodyText(index.properties, options.propertyBodyFields || []);
  const bodyText = [propertiesText, blockBodyText].filter(Boolean).join('\n\n');

  return {
    ...index,
    bodyText,
    blockCount: nestedBlocks.length,
    contentHash: hashContent(index.properties, bodyText),
  };
}

async function retrievePage(pageId: string): Promise<YokoNotionPageContent> {
  const page = await notionRequest<NotionPage>(`/pages/${pageId}`);
  return hydrateYokoNotionPage(pageIndex(page));
}

async function queryAllDataSourcePages(dataSourceId: string): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | null = null;

  do {
    const response: NotionList<NotionPage> = await notionRequest(`/data_sources/${dataSourceId}/query`, {
      method: 'POST',
      body: JSON.stringify({
        page_size: 100,
        result_type: 'page',
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    });
    pages.push(...response.results.filter((page) => page.object === 'page' && !page.archived && !page.in_trash));
    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);

  return pages;
}

async function queryDataSourceIndex(dataSourceId: string): Promise<YokoNotionPageIndex[]> {
  const pages = await queryAllDataSourcePages(dataSourceId);
  return pages.map(pageIndex);
}

async function retrieveDataSourceEntries(dataSourceId: string): Promise<YokoNotionPageContent[]> {
  const pages = await queryDataSourceIndex(dataSourceId);
  const entries: YokoNotionPageContent[] = [];
  for (const page of pages) entries.push(await hydrateYokoNotionPage(page));
  return entries;
}

async function notionGet(path: string): Promise<void> {
  await notionRequest(path);
}

export async function getYokoNotionConnectionStatus(): Promise<YokoNotionConnectionStatus> {
  const sources = await Promise.all(YOKO_NOTION_SOURCES.map(async (source) => {
    try {
      await notionGet(source.path);
      return { key: source.key, label: source.label, accessible: true };
    } catch {
      return { key: source.key, label: source.label, accessible: false };
    }
  }));

  return {
    connected: sources.every((source) => source.accessible),
    sources,
  };
}

export async function getAllYokoNotionContent(): Promise<YokoNotionCorpus> {
  const corePages = await getYokoNotionCorePages();
  const instagramScripts = await retrieveDataSourceEntries(YOKO_NOTION_IDS.instagramScripts);
  const gemKnowledge = await retrieveDataSourceEntries(YOKO_NOTION_IDS.gemKnowledge);

  return {
    corePages,
    instagramScripts,
    gemKnowledge,
  };
}

export async function getYokoNotionCorePages(): Promise<YokoNotionCorpus['corePages']> {
  const [startHere, styleGuide, generationPrompt] = await Promise.all([
    retrievePage(YOKO_NOTION_IDS.startHere),
    retrievePage(YOKO_NOTION_IDS.styleGuide),
    retrievePage(YOKO_NOTION_IDS.generationPrompt),
  ]);
  return { startHere, styleGuide, generationPrompt };
}

export async function getYokoNotionDataSourceIndexes() {
  const [instagramScripts, gemKnowledge] = await Promise.all([
    queryDataSourceIndex(YOKO_NOTION_IDS.instagramScripts),
    queryDataSourceIndex(YOKO_NOTION_IDS.gemKnowledge),
  ]);
  return {
    instagramScripts,
    gemKnowledge,
  };
}

export async function getYokoNotionDataSourceIndex(
  sourceType: 'instagram_script' | 'gem_knowledge',
): Promise<YokoNotionPageIndex[]> {
  return queryDataSourceIndex(
    sourceType === 'instagram_script'
      ? YOKO_NOTION_IDS.instagramScripts
      : YOKO_NOTION_IDS.gemKnowledge,
  );
}
