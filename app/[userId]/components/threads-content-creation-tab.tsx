'use client';

import { useCallback, useEffect, useState } from 'react';

type DraftStatus = 'review' | 'approved' | 'style_review' | 'stock' | 'discarded' | 'ready' | 'line_sent';

type CreationSource = {
  notionPageId: string;
  sourceType: 'instagram_script' | 'gem_knowledge';
  role: 'primary' | 'reference' | 'knowledge';
  title: string;
  url: string;
  bodyText: string;
};

type CreationDraft = {
  id: string;
  batchId: string;
  number: number;
  theme: string;
  mainText: string;
  comment1: string;
  comment2: string;
  status: DraftStatus;
  approvedSnapshot: { mainText: string; comment1: string; comment2: string } | null;
  lineMessageId: string | null;
  scheduleId: string | null;
  threadId: string | null;
  lastError: string | null;
  manualSavedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sources: CreationSource[];
};

type ListResponse = {
  drafts: CreationDraft[];
  total: number;
  page: number;
  pageSize: number;
  usage: { inputTokens: number; outputTokens: number; estimatedCostUsd: number | null };
  counts: Partial<Record<DraftStatus, number>>;
};

const STATUS_META: Record<DraftStatus, { label: string; shortLabel: string; className: string }> = {
  review: { label: '確認待ち', shortLabel: '確認待ち', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  approved: { label: '内容採用', shortLabel: '採用', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  style_review: { label: '本人文体の確認待ち', shortLabel: '文体確認', className: 'border-purple-200 bg-purple-50 text-purple-700' },
  stock: { label: 'ストック', shortLabel: 'ストック', className: 'border-cyan-200 bg-cyan-50 text-cyan-700' },
  discarded: { label: '完全ボツ', shortLabel: '完全ボツ', className: 'border-rose-200 bg-rose-50 text-rose-700' },
  ready: { label: '完成', shortLabel: '完成', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  line_sent: { label: 'LINE送信済み', shortLabel: '送信済み', className: 'border-slate-200 bg-slate-100 text-slate-700' },
};

const FILTERS: Array<{ key: 'all' | DraftStatus; label: string }> = [
  { key: 'all', label: 'すべて' },
  { key: 'review', label: '確認待ち' },
  { key: 'approved', label: '採用' },
  { key: 'style_review', label: '文体確認' },
  { key: 'stock', label: 'ストック' },
  { key: 'discarded', label: '完全ボツ' },
  { key: 'ready', label: '完成' },
  { key: 'line_sent', label: '送信済み' },
];

const STORED_STYLE_AUDIT_ERROR_PREFIX = '本人文体監査NG（監査案保存済み）:';

function isGenerationValidationError(lastError: string): boolean {
  return /^投稿\d+:/.test(lastError);
}

function countText(value: string) {
  return Array.from(value.replace(/[\s\u3000]/g, '')).length;
}

function apiError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }
  return fallback;
}

export default function ThreadsContentCreationTab({ userId }: { userId: string }) {
  const [drafts, setDrafts] = useState<CreationDraft[]>([]);
  const [filter, setFilter] = useState<'all' | DraftStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(24);
  const [usage, setUsage] = useState<ListResponse['usage']>({ inputTokens: 0, outputTokens: 0, estimatedCostUsd: null });
  const [statusCounts, setStatusCounts] = useState<ListResponse['counts']>({});
  const [dirtyDraftIds, setDirtyDraftIds] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [linePreview, setLinePreview] = useState<null | {
    destination: { name: string; groupId: string };
    format: string;
    requestId: string;
    drafts: Array<CreationDraft & { candidateScheduledAtJst: string }>;
  }>(null);
  const [config, setConfig] = useState<null | {
    notion: { connected: boolean };
    openai: { configured: boolean; draftModel: string; styleModel: string; auditModel: string };
  }>(null);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ userId, status: filter, page: String(page), pageSize: String(pageSize) });
      if (search.trim()) params.set('search', search.trim());
      const response = await fetch(`/api/threads/content-drafts?${params}`, { cache: 'no-store' });
      const payload = await response.json() as ListResponse | { error?: string };
      if (!response.ok) throw new Error(apiError(payload, '投稿一覧の取得に失敗しました'));
      const result = payload as ListResponse;
      setDrafts(result.drafts);
      setTotal(result.total);
      setUsage(result.usage);
      setStatusCounts(result.counts || {});
      setSelectedId((current) => result.drafts.some((draft) => draft.id === current) ? current : result.drafts[0]?.id || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '投稿一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [filter, page, pageSize, search, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDrafts(), search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadDrafts, search]);

  useEffect(() => {
    void fetch(`/api/threads/content-drafts/config?userId=${encodeURIComponent(userId)}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => setConfig(payload))
      .catch(() => setConfig(null));
  }, [userId]);

  const selectedDraft = drafts.find((draft) => draft.id === selectedId) || drafts[0] || null;
  const approvedCount = drafts.filter((draft) => draft.status === 'approved').length;
  const readyForLine = drafts.filter((draft) => (
    draft.status === 'ready' && !draft.lineMessageId && !draft.scheduleId && !draft.threadId
  ));
  const readyCount = readyForLine.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const updateLocalDraft = (id: string, patch: Partial<CreationDraft>) => {
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));
    setDirtyDraftIds((current) => new Set(current).add(id));
    setNotice(null);
  };

  const persistDraft = async (
    draft: CreationDraft,
    patch: Partial<CreationDraft>,
    actionLabel: string,
    options: { markSaved?: boolean; preserveError?: boolean } = {},
  ) => {
    setWorking(draft.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/threads/content-drafts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          draftId: draft.id,
          theme: patch.theme ?? draft.theme,
          mainText: patch.mainText ?? draft.mainText,
          comment1: patch.comment1 ?? draft.comment1,
          comment2: patch.comment2 ?? draft.comment2,
          ...(patch.status ? { status: patch.status } : {}),
          ...(options.markSaved ? { markSaved: true } : {}),
          ...(options.preserveError ? { preserveError: true } : {}),
        }),
      });
      const payload = await response.json() as { draft?: CreationDraft; error?: string };
      if (!response.ok || !payload.draft) throw new Error(apiError(payload, `${actionLabel}に失敗しました`));
      setDrafts((current) => current.map((item) => item.id === draft.id ? payload.draft! : item));
      setDirtyDraftIds((current) => {
        const next = new Set(current);
        next.delete(draft.id);
        return next;
      });
      setNotice(`${actionLabel}しました。`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : `${actionLabel}に失敗しました`);
    } finally {
      setWorking(null);
    }
  };

  const generateDrafts = async () => {
    setWorking('generate');
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/threads/content-drafts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const payload = await response.json() as { drafts?: CreationDraft[]; error?: string };
      if (!response.ok) throw new Error(apiError(payload, '6件の投稿作成に失敗しました'));
      setFilter('all');
      setPage(1);
      setNotice('最新のNotion台本を同期し、新規台本を最大1件、既存の未使用台本を残りに使って6件作成しました。');
      await loadDrafts();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : '6件の投稿作成に失敗しました');
    } finally {
      setWorking(null);
    }
  };

  const styleApprovedDrafts = async () => {
    const draftIds = drafts.filter((draft) => draft.status === 'approved').map((draft) => draft.id);
    setWorking('style');
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/threads/content-drafts/style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, draftIds, fields: ['comment1', 'comment2'] }),
      });
      const payload = await response.json() as { drafts?: CreationDraft[]; error?: string };
      if (!response.ok) throw new Error(apiError(payload, '本人文体への調整に失敗しました'));
      const styledCount = payload.drafts?.filter((draft) => draft.status === 'style_review').length || 0;
      const failedCount = (payload.drafts?.length || 0) - styledCount;
      setFilter(failedCount === 0 ? 'style_review' : 'all');
      setPage(1);
      setNotice(failedCount === 0
        ? `${styledCount}件のコメント1・2だけを本人文体へ調整しました。メイン投稿は変更していません。`
        : `${styledCount}件を反映、${failedCount}件は監査NGです。監査対象の本人文体案を編集欄に保存し、採用原文は別に保持しています。`);
      await loadDrafts();
    } catch (styleError) {
      setError(styleError instanceof Error ? styleError.message : '本人文体への調整に失敗しました');
    } finally {
      setWorking(null);
    }
  };

  const restyleDraft = async (draft: CreationDraft) => {
    setWorking(draft.id);
    setError(null);
    setNotice(null);
    try {
      const saveResponse = await fetch('/api/threads/content-drafts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          draftId: draft.id,
          theme: draft.theme,
          mainText: draft.mainText,
          comment1: draft.comment1,
          comment2: draft.comment2,
          markSaved: true,
          preserveError: true,
        }),
      });
      const savePayload = await saveResponse.json() as { draft?: CreationDraft; error?: string };
      if (!saveResponse.ok || !savePayload.draft) throw new Error(apiError(savePayload, '修正案の保存に失敗しました'));

      const styleResponse = await fetch('/api/threads/content-drafts/style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, draftIds: [draft.id], fields: ['comment1', 'comment2'] }),
      });
      const stylePayload = await styleResponse.json() as { drafts?: CreationDraft[]; error?: string };
      if (!styleResponse.ok) throw new Error(apiError(stylePayload, '修正案の再調整・監査に失敗しました'));
      const result = stylePayload.drafts?.[0];
      setNotice(result?.status === 'style_review'
        ? '修正内容を本人文体へ再調整し、監査に合格しました。'
        : '再監査はNGでした。新しい監査対象案と指摘を表示しています。');
      await loadDrafts();
    } catch (styleError) {
      setError(styleError instanceof Error ? styleError.message : '修正案の再調整・監査に失敗しました');
    } finally {
      setWorking(null);
    }
  };

  const prepareLinePreview = async () => {
    const draftIds = readyForLine.map((draft) => draft.id);
    setWorking('line');
    setError(null);
    try {
      const response = await fetch('/api/threads/content-drafts/line-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, draftIds }),
      });
      const payload = await response.json() as {
        destination?: { name: string; groupId: string };
        format?: string;
        requestId?: string;
        drafts?: Array<CreationDraft & { candidateScheduledAtJst: string }>;
        error?: string;
      };
      if (!response.ok || !payload.destination || !payload.drafts || !payload.format || !payload.requestId) {
        throw new Error(apiError(payload, 'LINEプレビューの作成に失敗しました'));
      }
      setLinePreview({ destination: payload.destination, format: payload.format, requestId: payload.requestId, drafts: payload.drafts });
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'LINEプレビューの作成に失敗しました');
    } finally {
      setWorking(null);
    }
  };

  const sendLinePreview = async () => {
    if (!linePreview) return;
    if (!window.confirm(`${linePreview.destination.name}へ${linePreview.drafts.length}件を送信します。よろしいですか？`)) return;
    setWorking('line-send');
    setError(null);
    try {
      const response = await fetch('/api/threads/content-drafts/line-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          requestId: linePreview.requestId,
          draftIds: linePreview.drafts.map((draft) => draft.id),
        }),
      });
      const payload = await response.json() as { sent?: boolean; lineMessageId?: string; error?: string };
      if (!response.ok || !payload.sent || !payload.lineMessageId) {
        throw new Error(apiError(payload, 'LINE送信に失敗しました'));
      }
      const count = linePreview.drafts.length;
      setLinePreview(null);
      setNotice(`${count}件をLINEへ送信しました。`);
      await loadDrafts();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'LINE送信に失敗しました');
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="ui-card overflow-hidden">
        <div className="space-y-3 border-b border-[color:var(--color-border)] p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
              {FILTERS.map((item) => {
                const count = item.key === 'all'
                  ? Object.values(statusCounts).reduce((sum, value) => sum + (value || 0), 0)
                  : statusCounts[item.key] || 0;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => { setFilter(item.key); setPage(1); }}
                    className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                      filter === item.key
                        ? 'border-purple-200 bg-purple-50 text-purple-700'
                        : 'border-[color:var(--color-border)] bg-white text-[color:var(--color-text-secondary)] hover:bg-slate-50'
                    }`}
                  >
                    {item.label} {count}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!!working}
                onClick={generateDrafts}
                className="h-10 shrink-0 rounded-[var(--radius-sm)] bg-[color:var(--color-accent)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {working === 'generate' ? '同期・6件作成中…' : '投稿作成'}
              </button>
              <button
                type="button"
                disabled={approvedCount === 0 || !!working}
                onClick={styleApprovedDrafts}
                className="h-10 shrink-0 rounded-[var(--radius-sm)] bg-purple-600 px-4 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {working === 'style' ? '本人文体へ調整中…' : `${approvedCount}件を本人文体に整える`}
              </button>
              <button
                type="button"
                disabled={readyCount === 0 || !!working}
                onClick={prepareLinePreview}
                className="h-10 shrink-0 rounded-[var(--radius-sm)] bg-[#06C755] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {working === 'line' ? 'プレビュー作成中…' : `${readyCount}件をLINEへ送る`}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="テーマ・本文を検索"
              className="h-10 w-full rounded-lg border border-[color:var(--color-border)] bg-white px-3 text-sm outline-none focus:border-purple-300 md:max-w-sm"
            />
            <p className="text-xs font-semibold text-purple-700">本人文体の対象：コメント1・2のみ（メイン投稿は変更しません）</p>
          </div>
        </div>

        {error ? <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

        {loading ? (
          <div className="p-10 text-center text-sm text-[color:var(--color-text-secondary)]">投稿を読み込んでいます…</div>
        ) : drafts.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">該当する投稿はありません</p>
            <p className="mt-2 text-xs leading-5 text-[color:var(--color-text-secondary)]">
              初回はNotion同期後に「投稿作成」を押すと、未使用台本から6件作成します。
            </p>
          </div>
        ) : selectedDraft ? (
          <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(390px,1.1fr)]">
            <div className="border-b border-[color:var(--color-border)] p-4 lg:border-b-0 lg:border-r">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {drafts.map((draft) => {
                  const status = STATUS_META[draft.status];
                  const isSelected = draft.id === selectedDraft.id;
                  const isDirty = dirtyDraftIds.has(draft.id);
                  const primarySource = draft.sources.find((source) => source.role === 'primary');
                  return (
                    <article key={draft.id} className={`rounded-[var(--radius-md)] border bg-white p-4 transition-shadow ${isSelected ? 'border-purple-300 shadow-sm ring-2 ring-purple-100' : 'border-[color:var(--color-border)] hover:shadow-sm'}`}>
                      <button type="button" onClick={() => setSelectedId(draft.id)} className="w-full text-left">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[color:var(--color-text-secondary)]">投稿 #{String(draft.number).padStart(2, '0')}</span>
                          <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${status.className}`}>{status.shortLabel}</span>
                        </div>
                        {draft.threadId ? <p className="mt-2 text-[11px] font-semibold text-slate-600">投稿済み</p>
                          : draft.scheduleId ? <p className="mt-2 text-[11px] font-semibold text-amber-700">予約・送信処理済み</p>
                            : null}
                        <h3 className="mt-3 line-clamp-2 text-sm font-semibold text-[color:var(--color-text-primary)]">{draft.theme}</h3>
                        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-[color:var(--color-text-secondary)]">{draft.mainText}</p>
                        <p className={`mt-2 text-[11px] font-semibold ${isDirty ? 'text-rose-600' : draft.manualSavedAt ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {isDirty ? '未保存の変更あり' : draft.manualSavedAt ? '下書き保存済み' : '下書き未保存'}
                        </p>
                        {draft.lastError ? <p className="mt-2 text-[11px] font-semibold text-rose-600">要修正あり</p> : null}
                        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                          <span className="truncate">{primarySource?.title || '元台本未設定'}</span>
                          <span>{countText(draft.mainText)}文字</span>
                        </div>
                      </button>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {(['review', 'stock', 'discarded'] as DraftStatus[]).includes(draft.status) ? (
                          <button type="button" disabled={working === draft.id} onClick={() => void persistDraft(draft, { status: 'approved' }, '内容を採用')} className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-40">採用</button>
                        ) : null}
                        {draft.status !== 'stock' && draft.status !== 'line_sent' ? (
                          <button type="button" disabled={working === draft.id} onClick={() => void persistDraft(draft, { status: 'stock' }, 'ストックへ移動')} className="rounded-lg border border-cyan-200 bg-cyan-50 px-2 py-2 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 disabled:opacity-40">ストック</button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-[color:var(--color-text-secondary)]">
                <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">前へ</button>
                <span>{page} / {pageCount}ページ（全{total}件）</span>
                <button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">次へ</button>
              </div>
            </div>

            <div className="p-4 md:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[color:var(--color-text-secondary)]">投稿 #{String(selectedDraft.number).padStart(2, '0')}を編集</p>
                  <input value={selectedDraft.theme} onChange={(event) => updateLocalDraft(selectedDraft.id, { theme: event.target.value })} className="mt-1 w-full border-0 bg-transparent p-0 text-base font-semibold text-[color:var(--color-text-primary)] outline-none" />
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-2 text-xs font-semibold ${dirtyDraftIds.has(selectedDraft.id) ? 'border-rose-200 bg-rose-50 text-rose-700' : selectedDraft.manualSavedAt ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                    {dirtyDraftIds.has(selectedDraft.id) ? '未保存の変更あり' : selectedDraft.manualSavedAt ? '下書き保存済み' : '下書き未保存'}
                  </span>
                  <span className={`rounded-full border px-3 py-2 text-xs font-semibold ${STATUS_META[selectedDraft.status].className}`}>{STATUS_META[selectedDraft.status].label}</span>
                </div>
              </div>

              {selectedDraft.lastError ? (
                <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-xs leading-5 text-rose-700">
                  <p className="font-semibold">{selectedDraft.lastError.startsWith(STORED_STYLE_AUDIT_ERROR_PREFIX)
                    ? '下のコメント1・2は、監査NGになった本人文体案です。指摘箇所を直接修正できます。'
                    : isGenerationValidationError(selectedDraft.lastError)
                      ? '生成時の品質チェックです。下の該当箇所を修正して「下書き保存」を押してください。'
                      : '以前の監査エラーです。「修正内容で再調整・監査」を押すと、指摘と一致する本人文体案を表示します。'}</p>
                  <p className="mt-1">{selectedDraft.lastError}</p>
                </div>
              ) : null}

              {(selectedDraft.status === 'style_review' || selectedDraft.lastError) && selectedDraft.approvedSnapshot ? (
                <details className="mt-4 rounded-lg border border-purple-200 bg-purple-50 px-3 py-3 text-xs text-purple-800">
                  <summary className="cursor-pointer font-semibold">採用済み原文を確認（変更されません）</summary>
                  <div className="mt-2 space-y-2 whitespace-pre-wrap rounded-md bg-white/70 p-3 leading-5">
                    <p>{selectedDraft.approvedSnapshot.mainText}</p>
                    <p>{selectedDraft.approvedSnapshot.comment1}</p>
                    <p>{selectedDraft.approvedSnapshot.comment2}</p>
                  </div>
                </details>
              ) : null}

              <div className="mt-5 space-y-4">
                {([
                  ['mainText', 'メイン投稿', selectedDraft.mainText, 3],
                  ['comment1', 'コメント欄1', selectedDraft.comment1, 10],
                  ['comment2', 'コメント欄2', selectedDraft.comment2, 10],
                ] as const).map(([field, label, value, rows]) => (
                  <label key={field} className="block text-xs font-medium text-[color:var(--color-text-secondary)]">
                    {(selectedDraft.status === 'style_review' || selectedDraft.lastError?.startsWith(STORED_STYLE_AUDIT_ERROR_PREFIX)) && field !== 'mainText' ? `本人文体版・${label}` : label}
                    <textarea value={value} rows={rows} onChange={(event) => updateLocalDraft(selectedDraft.id, { [field]: event.target.value })} className="mt-2 w-full resize-y rounded-lg border border-[color:var(--color-border)] bg-white px-3 py-3 text-sm leading-6 text-[color:var(--color-text-primary)] outline-none transition focus:border-purple-300 focus:ring-2 focus:ring-purple-100" />
                    <span className="mt-1 block text-right text-[11px] text-slate-400">{countText(value)}文字</span>
                  </label>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2 border-t border-[color:var(--color-border)] pt-4">
                <button type="button" disabled={working === selectedDraft.id} onClick={() => void persistDraft(selectedDraft, {}, '下書きを保存', {
                  markSaved: true,
                  preserveError: selectedDraft.lastError?.startsWith(STORED_STYLE_AUDIT_ERROR_PREFIX) === true,
                })} className="h-10 rounded-lg border border-[color:var(--color-border)] bg-white px-4 text-sm font-semibold text-[color:var(--color-text-primary)] hover:bg-slate-50 disabled:opacity-40">下書き保存</button>
                {selectedDraft.status === 'approved' && selectedDraft.lastError ? (
                  <button type="button" disabled={working === selectedDraft.id} onClick={() => void restyleDraft(selectedDraft)} className="h-10 rounded-lg bg-purple-600 px-4 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-40">
                    {working === selectedDraft.id ? '再調整・監査中…' : '修正内容で再調整・監査'}
                  </button>
                ) : null}
                {selectedDraft.status === 'approved' && selectedDraft.lastError && selectedDraft.approvedSnapshot ? (
                  <button type="button" disabled={working === selectedDraft.id} onClick={() => void persistDraft(selectedDraft, {
                    mainText: selectedDraft.approvedSnapshot!.mainText,
                    comment1: selectedDraft.approvedSnapshot!.comment1,
                    comment2: selectedDraft.approvedSnapshot!.comment2,
                  }, '採用原文へ戻す')} className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40">採用原文へ戻す</button>
                ) : null}
                {(['review', 'stock', 'discarded'] as DraftStatus[]).includes(selectedDraft.status) ? (
                  <button type="button" disabled={working === selectedDraft.id} onClick={() => void persistDraft(selectedDraft, { status: 'approved' }, '内容を採用')} className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">内容採用</button>
                ) : null}
                {selectedDraft.status === 'style_review' ? (
                  <button type="button" disabled={working === selectedDraft.id} onClick={() => void persistDraft(selectedDraft, { status: 'ready' }, '文体OK・完成に変更')} className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">文体OK・完成</button>
                ) : null}
                {selectedDraft.status !== 'stock' && selectedDraft.status !== 'line_sent' ? (
                  <button type="button" disabled={working === selectedDraft.id} onClick={() => void persistDraft(selectedDraft, { status: 'stock' }, 'ストックへ移動')} className="h-10 rounded-lg border border-cyan-200 bg-cyan-50 px-4 text-sm font-semibold text-cyan-700 hover:bg-cyan-100 disabled:opacity-40">ストック</button>
                ) : null}
                {selectedDraft.status !== 'discarded' && selectedDraft.status !== 'line_sent' ? (
                  <button type="button" disabled={working === selectedDraft.id} onClick={() => void persistDraft(selectedDraft, { status: 'discarded' }, '完全ボツへ移動')} className="h-10 rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-40">完全ボツ</button>
                ) : null}
                {(selectedDraft.status === 'ready' || selectedDraft.status === 'line_sent') ? (
                  <button type="button" disabled={working === selectedDraft.id} onClick={() => void persistDraft(selectedDraft, { status: selectedDraft.status === 'line_sent' ? 'ready' : 'style_review' }, '文体確認へ戻す')} className="h-10 rounded-lg border border-purple-200 bg-purple-50 px-4 text-sm font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-40">文体確認へ戻す</button>
                ) : null}
              </div>

              <section className="mt-6 border-t border-[color:var(--color-border)] pt-5">
                <h4 className="text-sm font-semibold text-[color:var(--color-text-primary)]">元台本・根拠</h4>
                <div className="mt-3 space-y-2">
                  {selectedDraft.sources.length ? selectedDraft.sources.map((source) => (
                    <details key={`${source.notionPageId}-${source.role}`} className="rounded-lg border border-[color:var(--color-border)] bg-slate-50 px-3 py-3">
                      <summary className="cursor-pointer text-xs font-semibold text-[color:var(--color-text-primary)]">
                        {source.role === 'primary' ? '元台本' : '宝石ノウハウ'}：{source.title}
                      </summary>
                      <p className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap text-xs leading-6 text-[color:var(--color-text-secondary)]">{source.bodyText || '本文はまだ同期されていません。'}</p>
                      {source.url ? <a href={source.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-semibold text-purple-700 underline">Notionで開く</a> : null}
                    </details>
                  )) : <p className="text-xs text-[color:var(--color-text-secondary)]">元台本の紐付けがありません。</p>}
                </div>
              </section>
            </div>
          </div>
        ) : null}
      </section>

      <section className="ui-card p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--color-text-primary)]">OpenAI API使用量</h3>
            <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">投稿作成と本人文体調整だけを集計します。手動編集・保存ではAPI料金は発生しません。</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-[color:var(--color-border)] bg-slate-50 px-3 py-2 text-slate-500">入力 {usage.inputTokens.toLocaleString()}</span>
            <span className="rounded-full border border-[color:var(--color-border)] bg-slate-50 px-3 py-2 text-slate-500">出力 {usage.outputTokens.toLocaleString()}</span>
            <span className="rounded-full border border-[color:var(--color-border)] bg-slate-50 px-3 py-2 text-slate-500">推定料金 {usage.estimatedCostUsd === null ? '単価未設定' : `$${usage.estimatedCostUsd.toFixed(4)}`}</span>
          </div>
        </div>
      </section>

      <section className="ui-card p-4 md:p-6">
        <h3 className="text-sm font-semibold text-[color:var(--color-text-primary)]">接続状況</h3>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className={`rounded-full border px-3 py-2 ${config?.notion.connected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
            Notion {config?.notion.connected ? '接続済み' : '未接続'}
          </span>
          <span className={`rounded-full border px-3 py-2 ${config?.openai.configured ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
            OpenAI API {config?.openai.configured ? '設定済み' : '未設定'}
          </span>
          {config?.openai.configured ? <span className="rounded-full border border-[color:var(--color-border)] bg-slate-50 px-3 py-2 text-slate-500">生成 {config.openai.draftModel} / 文体 {config.openai.styleModel} / 監査 {config.openai.auditModel}</span> : null}
        </div>
      </section>

      {linePreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold">LINE送信前プレビュー</h3>
                <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">送信先：{linePreview.destination.name}</p>
              </div>
              <button type="button" onClick={() => setLinePreview(null)} className="rounded-lg border px-3 py-2 text-sm">閉じる</button>
            </div>
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">予約・公開済みの投稿は除外済みです。内容と送信先を確認してから、下の送信ボタンを押してください。</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {linePreview.drafts.map((draft) => (
                <article key={draft.id} className="rounded-xl border border-[color:var(--color-border)] p-4">
                  <h4 className="text-sm font-semibold">投稿 #{String(draft.number).padStart(2, '0')}｜{draft.theme}</h4>
                  <p className="mt-2 text-xs font-semibold text-purple-700">予約候補：{new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: false }).format(new Date(draft.candidateScheduledAtJst))}</p>
                  <p className="mt-3 whitespace-pre-wrap text-xs leading-5">{draft.mainText}</p>
                  <p className="mt-3 whitespace-pre-wrap border-t pt-3 text-xs leading-5">{draft.comment1}</p>
                  <p className="mt-3 whitespace-pre-wrap border-t pt-3 text-xs leading-5">{draft.comment2}</p>
                </article>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2 border-t pt-4">
              <button type="button" disabled={working === 'line-send'} onClick={() => setLinePreview(null)} className="h-10 rounded-lg border px-4 text-sm font-semibold disabled:opacity-40">閉じる</button>
              <button type="button" disabled={working === 'line-send'} onClick={() => void sendLinePreview()} className="h-10 rounded-lg bg-[#06C755] px-5 text-sm font-semibold text-white disabled:opacity-40">
                {working === 'line-send' ? 'LINEへ送信中…' : `この${linePreview.drafts.length}件をLINEへ送信`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
