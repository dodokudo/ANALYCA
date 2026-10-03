'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { REFLECTION_FIELDS, ReflectionEditor, type ReflectionRevision } from '@/lib/report-reflection';

function savedTime(value: string): string {
  return new Date(value).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function ReportReflection({ userId, month }: { userId: string; month: string }) {
  const endpoint = `/api/reports/${encodeURIComponent(userId)}/${month}`;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [current, setCurrent] = useState<ReflectionRevision | null>(null);
  const editor = useRef(new ReflectionEditor(null));
  const [, redraw] = useState(0);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const alive = useRef(true);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (!alive.current) return;
      setCurrent(data.current);
      editor.current = new ReflectionEditor(data.current);
      setError(''); setConflict(false);
    } catch (cause) {
      if (alive.current) setLoadError(cause instanceof Error ? cause.message : '読み込めませんでした');
    } finally { if (alive.current) setLoading(false); }
  }, [endpoint]);
  useEffect(() => { void load(); }, [load]);

  async function save(): Promise<void> {
    if (inFlight.current || conflict) return;
    inFlight.current = true; setSaving(true); setError('');
    const model = editor.current;
    const input = model.begin(crypto.randomUUID());
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409 && alive.current) setConflict(true);
        throw new Error(data.error || '保存を確認できませんでした');
      }
      model.acknowledge(data.saved);
      if (alive.current) { setCurrent(data.saved); redraw(value => value + 1); }
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : '保存を確認できませんでした。再保存してください');
    } finally {
      inFlight.current = false;
      if (alive.current) setSaving(false);
    }
  }

  const model = editor.current;
  return <section className="ui-card p-4 md:p-6">
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={`reflection-${month}`}
      className="flex w-full items-center gap-2 text-left text-base font-semibold text-[color:var(--color-text-primary)]">
      <span aria-hidden="true" className="text-xs">{open ? '▼' : '▶'}</span>今月の振り返り
    </button>
    {open && <div id={`reflection-${month}`} className="mt-5">
      {loading ? <p role="status" className="text-sm text-gray-500">読み込み中…</p> : loadError ? <div role="alert" className="text-sm text-red-700">
        <p>{loadError}</p><button type="button" onClick={() => void load()} className="mt-2 underline">再読み込み</button>
      </div> : <div className="space-y-5">
        {REFLECTION_FIELDS.map(({ key, label, placeholder }) => <label key={key} className="block text-sm font-medium text-gray-800">
          {label}<textarea value={model.fields[key]} maxLength={10000} rows={4} placeholder={placeholder}
            onChange={event => { model.fields = { ...model.fields, [key]: event.target.value }; redraw(value => value + 1); }}
            className="mt-2 block w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal leading-7 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500" />
        </label>)}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void save()} disabled={saving || conflict || (!model.dirty && !model.pending)}
            className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-40">
            {saving ? '保存中…' : '保存'}
          </button>
          <span role="status" className="text-xs text-gray-500">{saving ? '保存を確認しています' : error ? '保存を確認できていません' : model.dirty ? '未保存の変更があります' : current ? `${savedTime(current.savedAt)} 保存済み` : ''}</span>
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {conflict && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <p>別の画面で更新されています。必要な文章をコピーしてから、最新の保存内容を読み込んでください。</p>
          <button type="button" onClick={() => void load()} className="mt-2 underline">最新の保存内容を読み込む</button>
        </div>}
      </div>}
    </div>}
  </section>;
}
