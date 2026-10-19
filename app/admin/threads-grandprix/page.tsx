'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import GrandprixEntryLink from '@/components/grandprix-entry-link';
import { GRANDPRIX_EVENTS, DEFAULT_GRANDPRIX_EVENT_ID, PUBLISHED_GRANDPRIX_RANKING_IDS, grandprixRankingUrl } from '@/lib/threads-grandprix-events';

type Entry = {
  id: string;
  originalThreadsUsername: string | null;
  lineName: string;
  threadsUsername: string;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse = {
  success: boolean;
  error?: string;
  data?: {
    entries: Entry[];
    fetchedAt: string;
  };
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(value));
}

export default function ThreadsGrandprixAdminPage() {
  const requestSequence = useRef(0);
  const [eventId, setEventId] = useState(DEFAULT_GRANDPRIX_EVENT_ID);
  const [password, setPassword] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState('');

  const csv = useMemo(() => {
    const header = ['LINE名', 'Threads ID', '登録日時', '更新日時'];
    const rows = entries.map((entry) => [
      entry.lineName,
      entry.threadsUsername,
      formatDate(entry.createdAt),
      formatDate(entry.updatedAt),
    ]);

    return [header, ...rows]
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(','))
      .join('\n');
  }, [entries]);

  async function fetchEntries(nextPassword = password, selectedEventId = eventId) {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError('');

    try {
      const query = new URLSearchParams({ event: selectedEventId });
      if (nextPassword) query.set('password', nextPassword);
      const response = await fetch(`/api/admin/threads-grandprix/entries?${query}`);
      const result = (await response.json()) as ApiResponse;
      if (requestId !== requestSequence.current) return;

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'エントリー一覧の取得に失敗しました');
      }

      setEntries(result.data.entries);
      setFetchedAt(result.data.fetchedAt);
    } catch (err) {
      if (requestId !== requestSequence.current) return;
      setEntries([]);
      setFetchedAt('');
      setError(err instanceof Error ? err.message : 'エントリー一覧の取得に失敗しました');
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }

  function downloadCsv() {
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `threads-grandprix-${eventId}-entries-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    const passwordFromUrl = new URLSearchParams(window.location.search).get('password') || '';

    if (passwordFromUrl) {
      setPassword(passwordFromUrl);
      fetchEntries(passwordFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 text-gray-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">Threads Grandprix</p>
            <h1 className="mt-1 text-2xl font-bold">エントリー管理</h1>
            <p className="mt-2 text-sm text-gray-500">
              LINE名とThreads IDを最新登録順で確認できます。
            </p>
          </div>

          <div className="flex flex-col gap-2 md:w-80">
            <label className="text-xs font-semibold text-gray-500" htmlFor="admin-password">
              管理パスワード
            </label>
            <div className="flex gap-2">
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="管理パスワード"
              />
              <button
                type="button"
                onClick={() => fetchEntries()}
                disabled={loading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {loading ? '取得中' : '表示'}
              </button>
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
          <label htmlFor="entry-event" className="mb-2 block text-sm font-semibold">開催回を選択</label>
          <select id="entry-event" value={eventId} onChange={(event) => {
            const selected = event.target.value;
            setEventId(selected); setEntries([]); setFetchedAt('');
            fetchEntries(password, selected);
          }} className="w-full rounded-lg border border-gray-300 px-3 py-2">
            {GRANDPRIX_EVENTS.map((event) => <option key={event.eventId} value={event.eventId}>
              第{event.edition}回 {event.name}（{event.startDate}〜{event.endDate}）
            </option>)}
          </select>
          {PUBLISHED_GRANDPRIX_RANKING_IDS.includes(eventId)
            ? <a href={grandprixRankingUrl(eventId)} className="mt-3 inline-block text-sm text-blue-600">この大会のランキング</a>
            : <p className="mt-3 text-sm text-gray-500">秋のランキングは公開準備中です。</p>}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500">合計</p>
              <p className="text-2xl font-bold">{entries.length}件</p>
              {fetchedAt && (
                <p className="mt-1 text-xs text-gray-400">更新: {formatDate(fetchedAt)}</p>
              )}
            </div>

            <button
              type="button"
              onClick={downloadCsv}
              disabled={!entries.length}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 disabled:opacity-50"
            >
              CSVダウンロード
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold text-gray-500">LINE名</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-500">Threads ID</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-500">登録日時</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-500">更新日時</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap px-5 py-3 font-medium">{entry.lineName}</td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <a
                        href={`https://www.threads.net/@${entry.threadsUsername}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-blue-600 hover:underline"
                      >
                        @{entry.threadsUsername}
                      </a>
                      <GrandprixEntryLink entry={entry} eventId={eventId} password={password} onSaved={() => { void fetchEntries(); }} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-gray-600">{formatDate(entry.createdAt)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-gray-600">{formatDate(entry.updatedAt)}</td>
                  </tr>
                ))}

                {!entries.length && !loading && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-gray-500">
                      エントリーはまだ表示されていません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
