import {
  getYokoNotionCorePages,
  getYokoNotionDataSourceIndex,
  getYokoNotionDataSourceIndexes,
  hydrateYokoNotionPage,
  type YokoNotionPageContent,
  type YokoNotionPageIndex,
} from '@/lib/yoko-notion';
import {
  getYokoNotionLedgerRows,
  syncYokoNotionLedger,
  type YokoNotionSourceType,
  type YokoNotionSyncSummary,
} from '@/lib/yoko-notion-ledger';

export type YokoNotionFullSyncResult = {
  corePages: Record<string, { characters: number; blocks: number; contentHash: string }>;
  instagramScripts: YokoNotionSyncSummary;
  gemKnowledge: YokoNotionSyncSummary;
};

export type YokoNotionBatchSyncResult = {
  sourceType: YokoNotionSourceType;
  processed: number;
  remaining: number;
  complete: boolean;
  summary: YokoNotionSyncSummary;
};

async function hydrateChangedPages(
  sourceType: YokoNotionSourceType,
  pages: YokoNotionPageIndex[],
): Promise<YokoNotionPageContent[]> {
  let previousRows = await getYokoNotionLedgerRows(sourceType);
  if (previousRows.length === 0 && pages.length > 0) {
    await syncYokoNotionLedger(sourceType, pages.map((page) => ({
      ...page,
      bodyText: '',
      blockCount: 0,
      contentHash: `metadata:${page.lastEditedTime}`,
    })), { completeSnapshot: true });
    previousRows = await getYokoNotionLedgerRows(sourceType);
  }
  const previousById = new Map(previousRows.map((row) => [row.notion_page_id, row]));
  const entries: YokoNotionPageContent[] = [];

  for (const page of pages) {
    const previous = previousById.get(page.id);
    if (previous && previous.body_text && previous.notion_last_edited_time === page.lastEditedTime) {
      entries.push({ ...page, bodyText: '', blockCount: 0, contentHash: previous.content_hash });
    } else {
      entries.push(await hydrateYokoNotionSourcePage(sourceType, page));
    }
  }

  return entries;
}

function hydrateYokoNotionSourcePage(
  sourceType: YokoNotionSourceType,
  page: YokoNotionPageIndex,
) {
  if (sourceType === 'instagram_script') {
    return hydrateYokoNotionPage(page, { followSourcePage: true });
  }
  return hydrateYokoNotionPage(page, {
    propertyBodyFields: [
      '知識',
      'カテゴリ',
      '要点',
      '条件・例外',
      '禁止・注意表現',
      '検証状態',
      '最終確認日',
      '外部根拠',
    ],
  });
}

export async function syncAllYokoNotionContent(): Promise<YokoNotionFullSyncResult> {
  const [corePages, indexes] = await Promise.all([
    getYokoNotionCorePages(),
    getYokoNotionDataSourceIndexes(),
  ]);
  const [scriptEntries, knowledgeEntries] = await Promise.all([
    hydrateChangedPages('instagram_script', indexes.instagramScripts),
    hydrateChangedPages('gem_knowledge', indexes.gemKnowledge),
  ]);
  const [instagramScripts, gemKnowledge] = await Promise.all([
    syncYokoNotionLedger('instagram_script', scriptEntries),
    syncYokoNotionLedger('gem_knowledge', knowledgeEntries),
  ]);

  return {
    corePages: Object.fromEntries(Object.entries(corePages).map(([key, page]) => [key, {
      characters: page.bodyText.length,
      blocks: page.blockCount,
      contentHash: page.contentHash,
    }])),
    instagramScripts,
    gemKnowledge,
  };
}

export async function syncYokoNotionContentBatch(
  sourceType: YokoNotionSourceType,
  limit = 75,
): Promise<YokoNotionBatchSyncResult> {
  const batchLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
  const pages = await getYokoNotionDataSourceIndex(sourceType);
  const previousRows = await getYokoNotionLedgerRows(sourceType);
  const previousById = new Map(previousRows.map((row) => [row.notion_page_id, row]));
  const pendingPages = pages.filter((page) => {
    const previous = previousById.get(page.id);
    return !previous?.body_text || previous.notion_last_edited_time !== page.lastEditedTime;
  }).sort((left, right) => Date.parse(right.lastEditedTime) - Date.parse(left.lastEditedTime));
  const selectedPages = pendingPages.slice(0, batchLimit);
  const entries: YokoNotionPageContent[] = [];
  for (const page of selectedPages) entries.push(await hydrateYokoNotionSourcePage(sourceType, page));

  let summary = await syncYokoNotionLedger(sourceType, entries, { completeSnapshot: false });
  const remaining = Math.max(0, pendingPages.length - selectedPages.length);
  if (remaining === 0) {
    const completeEntries = await hydrateChangedPages(sourceType, pages);
    summary = await syncYokoNotionLedger(sourceType, completeEntries, { completeSnapshot: true });
  }

  return {
    sourceType,
    processed: selectedPages.length,
    remaining,
    complete: remaining === 0,
    summary,
  };
}
