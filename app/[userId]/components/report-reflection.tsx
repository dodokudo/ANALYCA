'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { REFLECTION_FIELDS, type ReflectionRevision } from '@/lib/report-reflection';
import { parseRewriteWrite, RewriteEditor, submissionIssues, type RewriteRevision, type RewriteState, type RewriteStatus } from '@/lib/report-rewrite';
import { reportButton, ReportRewriteForm, ReportRewriteView } from './report-rewrite-content';

function savedTime(value: string): string {
  return new Date(value).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function ReportReflection({ userId, month, onDirtyChange }: {
  userId: string; month: string; onDirtyChange?: (dirty: boolean) => void;
}) {
  const endpoint = `/api/reports/${encodeURIComponent(userId)}/${month}`;
  const [original, setOriginal] = useState<ReflectionRevision | null>(null);
  const [originalError, setOriginalError] = useState('');
  const [state, setState] = useState<RewriteState>({ current: null, submitted: null });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [mode, setMode] = useState<'read' | 'edit' | 'preview'>('read');
  const editor = useRef(new RewriteEditor(null));
  const [, redraw] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [issues, setIssues] = useState<string[]>([]);
  const [conflict, setConflict] = useState(false);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const errorBox = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const ticket = ++generation.current;
    setLoading(true);
    async function get(url: string) {
      const response = await fetch(url, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '読み込めませんでした');
      return data;
    }
    const results = await Promise.allSettled([get(endpoint), get(`${endpoint}/rewrite`)]);
    if (ticket !== generation.current) return;
    const [legacy, rewrite] = results;
    if (legacy.status === 'fulfilled') { setOriginal(legacy.value.current); setOriginalError(''); }
    else setOriginalError('当初の原文を読み込めませんでした。再読み込みしてください。');
    if (rewrite.status === 'fulfilled') {
      setState(rewrite.value);
      editor.current = new RewriteEditor(rewrite.value.current);
      setLoadError(''); setError(''); setConflict(false); setIssues([]);
    } else setLoadError(rewrite.reason instanceof Error ? rewrite.reason.message : '書き直し版を読み込めませんでした');
    setLoading(false);
  }, [endpoint]);
  useEffect(() => { void load(); return () => { generation.current += 1; }; }, [load]);
  const model = editor.current;
  const dirty = model.dirty || !!model.pending;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => { onDirtyChange?.(false); }, [onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => { if (issues.length || error) errorBox.current?.focus(); }, [issues, error]);

  async function save(status: RewriteStatus): Promise<void> {
    if (inFlight.current || conflict || loading || loadError) return;
    const currentModel = editor.current;
    if (!currentModel.pending && status === 'submitted') {
      const problems = submissionIssues(currentModel.report);
      setIssues(problems);
      if (problems.length) return;
    }
    if (!currentModel.pending) {
      try {
        // Validate before marking a request pending, so validation errors remain editable.
        const request = parseRewriteWrite({ expectedRevision: currentModel.revision, requestId: crypto.randomUUID(), status, report: currentModel.report });
        currentModel.pending = request;
      } catch (cause) { setError(cause instanceof Error ? cause.message : '入力を確認してください'); return; }
    }
    const ticket = generation.current;
    inFlight.current = true; setSaving(true); setError(''); setIssues([]);
    try {
      const response = await fetch(`${endpoint}/rewrite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(currentModel.pending),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409 && ticket === generation.current) setConflict(true);
        if (response.status === 400 || response.status === 403) currentModel.pending = null;
        throw new Error(data.error || '保存を確認できませんでした');
      }
      currentModel.acknowledge(data.saved as RewriteRevision);
      if (ticket !== generation.current) return;
      setState(previous => ({ current: data.saved, submitted: data.saved.status === 'submitted' ? data.saved : previous.submitted }));
      redraw(value => value + 1);
      if (data.saved.status === 'submitted' && !currentModel.dirty) setMode('read');
    } catch (cause) {
      if (ticket === generation.current) setError(cause instanceof Error ? cause.message : '保存を確認できませんでした。再試行してください');
    } finally {
      inFlight.current = false;
      if (ticket === generation.current) setSaving(false);
    }
  }

  function downloadInput(): void {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ month, userId, report: model.report, pending: model.pending }, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `report-${month}-draft.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const frozen = saving || !!model.pending;
  return <section className="ui-card p-4 md:p-6" aria-label="運用の説明レポート">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div><h3 className="text-lg font-semibold text-gray-900">運用の説明レポート</h3>
        <p className="mt-1 text-sm text-gray-500">実施したこと・結果・次の対応を、順番に確認できます。</p>
        {!loading && !loadError && <p className="mt-2 text-xs text-gray-500">{state.submitted ? `提出済み：${savedTime(state.submitted.savedAt)}` : '書き直し版は未提出です。'}{state.current?.status === 'draft' ? ` ／ 下書き保存：${savedTime(state.current.savedAt)}` : ''}</p>}
      </div>
      {!loading && !loadError && <button type="button" className={reportButton} onClick={() => setMode(mode === 'read' ? 'edit' : 'read')}>
        {mode === 'read' ? state.current ? '書き直し版を編集' : '書き直し版を作成' : '閲覧画面に戻る'}
      </button>}
    </div>

    {loading && <p role="status" className="py-4 text-sm text-gray-500">レポートを読み込み中…</p>}
    {!loading && (originalError || loadError) && <div role="alert" className="mb-5 rounded-lg bg-red-50 p-4 text-sm text-red-800">
      {originalError && <p>{originalError}</p>}{loadError && <p>{loadError}</p>}
      <button type="button" className="mt-2 underline" onClick={() => { if (!dirty || window.confirm('未保存の入力を破棄して再読み込みしますか？')) void load(); }}>再読み込み</button>
    </div>}

    {!loading && !originalError && <details key={state.submitted ? 'with-submitted' : 'without-submitted'} open={(mode === 'read' && !state.submitted) || undefined} className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-gray-800">当初の原文を読む{original ? `（${savedTime(original.savedAt)} 保存）` : ''}</summary>
      <p className="mt-3 text-xs leading-6 text-gray-500">担当者が以前記入した文章をそのまま保管しています。書き直し版を保存・提出しても、この原文は変わりません。</p>
      {original ? <div className="mt-4 space-y-6">{REFLECTION_FIELDS.map(field => <section key={field.key}>
        <h4 className="mb-2 text-sm font-semibold text-gray-900">{field.label}</h4>
        <p data-original-field={field.key} className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-700">{original.fields[field.key] || '（記入なし）'}</p>
      </section>)}</div> : <p className="mt-3 text-sm text-gray-500">この月に保存された原文はありません。</p>}
    </details>}

    {!loading && !loadError && mode === 'read' && (state.submitted
      ? <ReportRewriteView report={state.submitted.report} />
      : <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50 p-6 text-sm leading-7 text-gray-700">
        <p className="font-semibold">新しい項目でのレポートは、まだ提出されていません。</p>
        <p>担当者は「書き直し版を{state.current ? '編集' : '作成'}」から記入してください。下書きは、提出するまでこの閲覧画面には反映されません。</p>
      </div>)}

    {!loading && !loadError && mode !== 'read' && <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-violet-50 p-4">
        <div><p className="text-sm font-semibold text-violet-900">{mode === 'preview' ? '書き直し版のプレビュー（未提出の内容を含みます）' : '担当者用：書き直し版の入力'}</p>
          <p className="mt-1 text-xs leading-6 text-violet-800">原文を参照して、確認できた事実を記入してください。不明な点は「未確認」、推測は「仮説」と明記してください。</p></div>
        <button type="button" className={reportButton} onClick={() => setMode(mode === 'preview' ? 'edit' : 'preview')}>{mode === 'preview' ? '入力に戻る' : 'プレビュー'}</button>
      </div>
      {mode === 'edit' ? <fieldset disabled={frozen} className="min-w-0"><legend className="sr-only">書き直し版の8項目</legend>
        <ReportRewriteForm report={model.report} onChange={report => { model.report = report; redraw(value => value + 1); }} />
      </fieldset> : <ReportRewriteView report={model.report} />}
      {(error || issues.length > 0) && <div ref={errorBox} tabIndex={-1} role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
        {error && <p>{error}</p>}{issues.length > 0 && <><p className="font-semibold">提出前に確認してください（下書きは途中でも保存できます）</p><ul className="mt-2 list-inside list-disc space-y-1">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></>}
      </div>}
      {conflict && <div className="rounded-lg bg-amber-50 p-4 text-sm leading-7">
        <p>入力内容はこの画面に保持しています。まず控えをダウンロードし、最新の保存内容を確認してください。</p>
        <div className="mt-2 flex flex-wrap gap-2"><button type="button" className={reportButton} onClick={downloadInput}>入力内容をダウンロード</button>
          <button type="button" className={reportButton} onClick={() => { if (window.confirm('入力内容を控えましたか？ この画面の入力を最新の保存内容に置き換えます。')) void load(); }}>最新の保存内容を読み込む</button></div>
      </div>}
      <div className="sticky bottom-20 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur md:bottom-3">
        {model.pending ? <button type="button" disabled={saving || conflict} className={reportButton} onClick={() => void save(model.pending!.status)}>{saving ? '保存を確認中…' : '同じ内容で保存を再試行'}</button>
          : <><button type="button" className={reportButton} disabled={saving || conflict || (!dirty && !!state.current)} onClick={() => void save('draft')}>下書き保存</button>
            <button type="button" disabled={saving || conflict || (!dirty && state.current?.status === 'submitted')} onClick={() => void save('submitted')}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-40">提出して閲覧画面に反映</button></>}
        <span role="status" className="text-xs text-gray-500">{saving ? '保存を確認しています' : model.pending ? '保存結果が未確認です。再試行してください' : dirty ? '未保存の変更があります' : state.current ? `${savedTime(state.current.savedAt)} 保存済み` : '未保存'}</span>
        <p className="w-full text-xs text-gray-500">提出すると、このレポートの閲覧画面に反映されます。メール・LINE通知は送信されません。</p>
      </div>
    </div>}
  </section>;
}
