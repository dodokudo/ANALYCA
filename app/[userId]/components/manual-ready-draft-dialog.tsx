'use client';

import { useState } from 'react';
import { manualDraftErrors, type ManualDraftText } from '@/lib/yoko-manual-draft';

export default function ManualReadyDraftDialog({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (input: ManualDraftText & { requestId: string }) => Promise<void>;
}) {
  const [text, setText] = useState<ManualDraftText>({ theme: '', mainText: '', comment1: '', comment2: '' });
  const [requestId] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errors = manualDraftErrors(text);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="manual-ready-title"
      onKeyDown={event => { if (event.key === 'Escape' && !saving) onClose(); }}>
      <form className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onSubmit={async event => {
          event.preventDefault();
          if (saving || errors.length) return;
          setSaving(true);
          setError(null);
          try {
            await onCreate({ ...text, requestId });
          } catch (createError) {
            setError(createError instanceof Error ? createError.message : '投稿の保存に失敗しました');
          } finally {
            setSaving(false);
          }
        }}>
        <div className="flex items-start justify-between gap-4 border-b p-5">
          <div>
            <h3 id="manual-ready-title" className="text-base font-semibold">完成に投稿を追加</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">用意した原稿を入力・貼り付けて保存できます。保存後、完成一覧からLINEへ送る投稿を選べます。</p>
          </div>
          <button type="button" disabled={saving} onClick={onClose} className="shrink-0 rounded-lg border px-3 py-2 text-sm disabled:opacity-40">閉じる</button>
        </div>
        <div className="space-y-4 overflow-y-auto p-5">
          <label className="block text-sm font-medium">
            テーマ（任意）
            <input autoFocus disabled={saving} value={text.theme} maxLength={100}
              onChange={event => setText(current => ({ ...current, theme: event.target.value }))}
              placeholder="省略するとメイン投稿から付けます"
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-purple-400" />
          </label>
          {([
            ['mainText', 'メイン投稿', 3], ['comment1', 'コメント欄1', 6], ['comment2', 'コメント欄2', 6],
          ] as const).map(([field, label, rows]) => {
            const length = Array.from(text[field]).length;
            return (
              <label key={field} className="block text-sm font-medium">
                {label}
                <textarea required disabled={saving} value={text[field]} rows={rows}
                  onChange={event => setText(current => ({ ...current, [field]: event.target.value }))}
                  className="mt-2 w-full resize-y rounded-lg border px-3 py-2 text-sm leading-6 outline-none focus:border-purple-400" />
                <span className={`mt-1 block text-right text-xs ${length > 500 ? 'font-semibold text-rose-600' : 'text-slate-500'}`}>
                  {length} / 500文字{length > 500 ? `（${length - 500}文字オーバー）` : ''}
                </span>
              </label>
            );
          })}
          {error ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t bg-slate-50 p-4">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">キャンセル</button>
          <button type="submit" disabled={saving || errors.length > 0} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            {saving ? '保存中…' : '完成に保存'}
          </button>
        </div>
      </form>
    </div>
  );
}
