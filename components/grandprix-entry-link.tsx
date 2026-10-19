'use client';

import { useState } from 'react';

type Member = { user_id: string; threads_username: string };

export default function GrandprixEntryLink({ entry, eventId, password, onSaved }: {
  entry: { id: string; lineName: string; threadsUsername: string; originalThreadsUsername?: string | null };
  eventId: string;
  password: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  async function searchMembers() {
    setBusy(true); setError(''); setSelected(null); setMembers([]); setSearched(false);
    try {
      const response = await fetch(`/api/admin/threads-grandprix/entries?${new URLSearchParams({ searchUser: search })}`, {
        headers: { 'x-admin-password': password },
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || '会員を検索できませんでした');
      setMembers(result.users); setSearched(true);
    } catch (err) { setError(err instanceof Error ? err.message : '検索に失敗しました'); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/threads-grandprix/entries', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ entryId: entry.id, eventId, userId: selected.user_id, expectedUsername: entry.threadsUsername }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || '保存できませんでした');
      setOpen(false); onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : '保存に失敗しました'); }
    finally { setBusy(false); }
  }

  return <div className="mt-2 text-sm font-normal">
    {entry.originalThreadsUsername && entry.originalThreadsUsername !== entry.threadsUsername &&
      <p className="mb-1 text-xs text-gray-500">申込時: @{entry.originalThreadsUsername}</p>}
    <button type="button" className="text-blue-600 underline" onClick={() => {
      setSearch(entry.threadsUsername); setMembers([]); setSelected(null); setError(''); setSearched(false); setOpen(true);
    }}>会員を紐づける</button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section role="dialog" aria-modal="true" aria-label={`${entry.lineName}の会員紐づけ`}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto whitespace-normal rounded-xl bg-white p-6 text-gray-900 shadow-xl">
        <h2 className="text-lg font-bold">{entry.lineName}の会員紐づけ</h2>
        <p className="mt-2 text-sm text-gray-600">現在: @{entry.threadsUsername}</p>
        <form className="mt-4 flex gap-2" onSubmit={event => { event.preventDefault(); void searchMembers(); }}>
          <input autoFocus aria-label="Threads IDまたは会員ID" placeholder="Threads IDまたは会員ID" value={search}
            disabled={busy} onChange={event => { setSearch(event.target.value); setSelected(null); setMembers([]); setSearched(false); }}
            className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2" />
          <button disabled={busy || search.trim().replace(/^@/, '').length < 2} className="rounded bg-gray-100 px-3 py-2 disabled:opacity-50">検索</button>
        </form>
        <div className="my-3 space-y-2">
          {members.map(member => <label key={member.user_id} className="flex cursor-pointer gap-2 rounded border p-3">
            <input type="radio" name={`member-${entry.id}`} checked={selected?.user_id === member.user_id}
              disabled={busy} onChange={() => setSelected(member)} />
            <span>@{member.threads_username}<small className="block text-gray-500">会員ID: {member.user_id}</small></span>
          </label>)}
          {searched && !members.length && <p className="text-gray-500">該当する会員が見つかりません。</p>}
        </div>
        {selected && <p className="mb-3 text-sm">{entry.lineName}を @{selected.threads_username} に紐づけます。申込時のIDは履歴として残ります。</p>}
        {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded border px-4 py-2">閉じる</button>
          <button type="button" disabled={busy || !selected} onClick={save} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{busy ? '処理中…' : '紐づけを保存'}</button>
        </div>
      </section>
    </div>}
  </div>;
}
