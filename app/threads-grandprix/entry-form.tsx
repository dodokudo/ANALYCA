'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { GrandprixConnectionStatus } from '@/lib/threads-grandprix-connection';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

type EntryFormProps = {
  formId?: string;
  eventId?: string;
  entryOpen?: boolean;
  lineGroupUrl?: string | null;
};

export default function EntryForm({ formId = 'entry-form', eventId = '2026-summer', entryOpen = false, lineGroupUrl }: EntryFormProps) {
  const [lineName, setLineName] = useState('');
  const [threadsUsername, setThreadsUsername] = useState('');
  const [state, setState] = useState<SubmitState>('idle');
  const [message, setMessage] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<GrandprixConnectionStatus | null>(null);
  const lineNameId = `${formId}-line-name`;
  const threadsUsernameId = `${formId}-threads-username`;

  async function refreshConnection() {
    setState('submitting'); setMessage('');
    try {
      const response = await fetch('/api/threads-grandprix/entry', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || result.eventId !== eventId) throw new Error(result.error || '申込情報を確認できません。もう一度エントリーしてください。');
      setConnectionStatus(result.connectionStatus); setState('success');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '接続確認に失敗しました。'); setState('error');
    }
  }

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get('connection');
    if (result === 'complete' && formId === 'entry-form') refreshConnection();
    else if (result && formId === 'entry-form') {
      const messages: Record<string, string> = {
        mismatch: 'エントリーしたThreads IDと異なるアカウントです。申込時のアカウントで接続してください。',
        expired: '申込情報の有効期限が切れました。もう一度エントリーしてください。',
        denied: '接続は完了していません。必要な権限を許可して再度お試しください。',
        plan_required: '現在のプランではThreadsを接続できません。運営にお問い合わせください。',
        error: '接続を完了できませんでした。もう一度お試しください。',
      };
      setMessage(messages[result] || '接続状況を確認してください。');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!entryOpen) return <p className="py-4 text-center text-sm font-semibold text-gray-600">この大会のエントリー受付は終了しました。</p>;

  if (connectionStatus) return (
    <div id={formId} className="space-y-4 text-sm leading-relaxed">
      <p className="text-lg font-bold">秋のエントリーを受け付けました</p>
      {connectionStatus === 'connected' ? <>
        <p>Threadsの接続を確認できました。再接続は不要です。</p>
        {lineGroupUrl ? <a href={lineGroupUrl} className="block rounded-xl bg-emerald-600 px-4 py-4 text-center font-bold text-white">専用LINEグループへ進む</a>
          : <p>LINEグループの案内は準備中です。</p>}
      </> : connectionStatus === 'needs_check' ? <>
        <p>現在、接続状況を確認できません。少し時間をおいて再確認してください。繰り返す場合は運営にお問い合わせください。</p>
        <button type="button" onClick={refreshConnection} disabled={state === 'submitting'} className="w-full rounded-xl bg-gray-900 px-4 py-3 font-bold text-white">{state === 'submitting' ? '確認中...' : '接続状況を再確認'}</button>
      </> : <>
        <p>{connectionStatus === 'reconnect_required' ? 'Threadsとの接続を更新してください。' : 'ランキングのデータを取得するため、Threadsを接続してください。'}</p>
        <button type="button" onClick={() => window.location.assign('/api/threads-grandprix/connect')} className="block w-full rounded-xl bg-gray-900 px-4 py-4 text-center font-bold text-white">Threadsを接続する</button>
      </>}
      {message && <p role="alert" className="text-red-700">{message}</p>}
    </div>
  );

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
          eventId,
          lineName: normalizedLineName,
          threadsUsername: normalizedThreadsUsername,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '送信に失敗しました。');
      }

      setState('success');
      setConnectionStatus(result.connectionStatus);
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
        ※接続状況を確認し、必要な方だけThreadsの接続をご案内します。
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
