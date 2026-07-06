'use client';

import { FormEvent, useState } from 'react';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

type EntryFormProps = {
  formId?: string;
};

const lineGroupUrl = 'https://line.me/ti/g/8ErMS2M2vU';

export default function EntryForm({ formId = 'entry-form' }: EntryFormProps) {
  const [lineName, setLineName] = useState('');
  const [threadsUsername, setThreadsUsername] = useState('');
  const [state, setState] = useState<SubmitState>('idle');
  const [message, setMessage] = useState('');
  const lineNameId = `${formId}-line-name`;
  const threadsUsernameId = `${formId}-threads-username`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedLineName = lineName.trim();
    const normalizedThreadsUsername = threadsUsername.trim().replace(/^@/, '');

    if (!normalizedLineName || !normalizedThreadsUsername) {
      setState('error');
      setMessage('LINEの登録名とThreadsのユーザーIDを入力してください。');
      return;
    }

    setState('submitting');
    setMessage('');

    try {
      const response = await fetch('/api/threads-grandprix/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineName: normalizedLineName,
          threadsUsername: normalizedThreadsUsername,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '送信に失敗しました。');
      }

      setState('success');
      window.location.assign(lineGroupUrl);
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : '送信に失敗しました。時間をおいて再度お試しください。');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" id={formId}>
      <div>
        <label htmlFor={lineNameId} className="block text-sm font-semibold text-gray-900">
          LINEの登録名
        </label>
        <input
          id={lineNameId}
          name="lineName"
          value={lineName}
          onChange={(event) => setLineName(event.target.value)}
          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-gray-900"
          placeholder="例: 工藤"
          autoComplete="name"
          disabled={state === 'submitting' || state === 'success'}
        />
      </div>

      <div>
        <label htmlFor={threadsUsernameId} className="block text-sm font-semibold text-gray-900">
          ThreadsのユーザーID
        </label>
        <div className="mt-2 flex rounded-xl border border-gray-300 bg-white focus-within:border-transparent focus-within:ring-2 focus-within:ring-gray-900">
          <span className="flex items-center border-r border-gray-200 px-4 text-base font-semibold text-gray-500">
            @
          </span>
          <input
            id={threadsUsernameId}
            name="threadsUsername"
            value={threadsUsername}
            onChange={(event) => setThreadsUsername(event.target.value)}
            className="min-w-0 flex-1 rounded-r-xl px-4 py-3 text-base text-gray-900 outline-none placeholder:text-gray-400"
            placeholder="例: kudooo_ai"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={state === 'submitting' || state === 'success'}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={state === 'submitting' || state === 'success'}
        className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-emerald-400 px-5 py-4 text-base font-bold text-white shadow-[0_14px_28px_rgba(80,62,180,0.22)] transition-all hover:from-purple-600 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === 'submitting' ? '送信中...' : state === 'success' ? 'エントリー完了' : '今すぐエントリーする！'}
      </button>

      <p className="text-center text-xs font-medium leading-5 text-gray-500">
        ※エントリーでLINEグループへ招待します。
      </p>

      {message && (
        <p
          className={`rounded-xl px-3 py-2 text-xs font-medium leading-5 ${
            state === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
