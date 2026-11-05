'use client';

import { useEffect, useState } from 'react';
import { REFLECTION_FIELDS, type ReflectionRevision } from '@/lib/report-reflection';

export default function LegacyReportReflection({ userId, month }: { userId: string; month: string }) {
  const [current, setCurrent] = useState<ReflectionRevision | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const response = await fetch(`/api/reports/${encodeURIComponent(userId)}/${month}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '原文を読み込めませんでした');
        if (active) setCurrent(data.current);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : '原文を読み込めませんでした');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [userId, month, retry]);

  return <section aria-label="旧式レポート" className="space-y-5">
    {loading ? <p role="status" className="text-sm text-gray-500">読み込み中…</p>
      : error ? <div role="alert" className="text-sm text-red-700">
        <p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-2 underline">再読み込み</button>
      </div>
      : current ? REFLECTION_FIELDS.map(({ key, label }) => <section key={key}>
        <h4 className="mb-2 text-sm font-semibold text-gray-900">{label}</h4>
        <p data-original-field={key} className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-800">{current.fields[key] || '（記入なし）'}</p>
      </section>)
      : <p className="text-sm text-gray-500">この月の旧式レポートはありません。</p>}
  </section>;
}
