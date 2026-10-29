'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { beginThreadsReauthentication, THREADS_AUTH_INVALID_EVENT } from '@/lib/threads-reauth-client';
import type { ThreadsConnectionStatus } from '@/lib/threads-connection-status';

type ConnectionState = ThreadsConnectionStatus | 'checking' | 'not_connected';
type Recovery = { failedCount: number | null; failedScheduleId: string | null };
const REAUTH_ERRORS: Record<string, string> = {
  cancelled: '再接続はキャンセルされました。必要なときにもう一度お試しください。',
  wrong_account: '別のThreadsアカウントで認証されました。これまで連携していたアカウントで再接続してください。',
  error: '再接続を完了できませんでした。もう一度お試しください。',
  expired: '再接続の有効時間が過ぎました。もう一度お試しください。',
};

export function ThreadsConnectionBanner({ userId }: { userId: string }) {
  const [status, setStatus] = useState<ConnectionState>('checking');
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const lastChecked = useRef(0);
  const inFlight = useRef(false);
  const returnResult = useRef<string | null>(null);
  const generation = useRef(0);
  const invalidateCheck = useCallback(() => {
    generation.current++;
    inFlight.current = false;
  }, []);

  const checkConnection = useCallback(async (force = false) => {
    if (inFlight.current || (!force && Date.now() - lastChecked.current < 60000)) return;
    inFlight.current = true;
    const requestGeneration = generation.current;
    try {
      const includeFailures = returnResult.current === 'success';
      const params = new URLSearchParams({ userId, ...(includeFailures ? { includeFailures: '1' } : {}) });
      const response = await fetch(`/api/auth/threads/status?${params}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      const body = await response.json();
      if (requestGeneration !== generation.current) return;
      const nextStatus: ConnectionState = response.ok && ['connected', 'reauth_required', 'not_connected'].includes(body.status) ? body.status : 'unknown';
      setStatus(nextStatus);
      if (nextStatus === 'reauth_required') setRecovery(null);
      if (includeFailures && nextStatus === 'connected') {
        setRecovery({ failedCount: typeof body.failedCount === 'number' ? body.failedCount : null, failedScheduleId: body.failedScheduleId ?? null });
        setFailure(null);
        returnResult.current = null;
        const url = new URL(window.location.href);
        url.searchParams.delete('reauth');
        window.history.replaceState({}, '', url.toString());
      }
    } catch {
      if (requestGeneration === generation.current) setStatus('unknown');
    } finally {
      if (requestGeneration === generation.current) {
        lastChecked.current = Date.now();
        inFlight.current = false;
      }
    }
  }, [userId]);

  useEffect(() => {
    returnResult.current = new URLSearchParams(window.location.search).get('reauth');
    setFailure(REAUTH_ERRORS[returnResult.current ?? ''] ?? null);
    void checkConnection(true);
    const onFocus = () => { if (document.visibilityState === 'visible') void checkConnection(); };
    const onInvalid = (event: Event) => {
      if ((event as CustomEvent<{ userId: string }>).detail?.userId !== userId) return;
      invalidateCheck();
      setStatus('reauth_required');
      setRecovery(null);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener(THREADS_AUTH_INVALID_EVENT, onInvalid);
    return () => {
      invalidateCheck();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener(THREADS_AUTH_INVALID_EVENT, onInvalid);
    };
  }, [checkConnection, invalidateCheck, userId]);

  const reconnect = () => { if (beginThreadsReauthentication(userId)) setLeaving(true); };
  const button = <button type="button" disabled={leaving} onClick={reconnect} className="mt-3 rounded-lg bg-gray-900 px-4 py-2 font-semibold text-white disabled:opacity-50">{leaving ? 'Threadsへ移動中…' : 'Threadsに再接続'}</button>;

  if (status === 'reauth_required' || failure) return (
    <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-semibold">{failure ? 'Threadsの再接続が完了していません' : 'Threadsとの連携が切れています'}</p>
      <p className="mt-2">{failure || '予約投稿・データ更新を再開するには、これまで連携していたThreadsアカウントで再接続してください。'}</p>
      {button}
    </div>
  );
  if (status === 'unknown') return (
    <div role="status" className="mb-4 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
      Threadsの連携状態を確認できませんでした。
      <button type="button" className="ml-2 font-semibold underline" onClick={() => void checkConnection(true)}>再確認</button>
    </div>
  );
  if (!recovery || status !== 'connected') return null;
  const review = new URLSearchParams({ tab: 'threads', threadsTab: 'schedule', ...(recovery.failedScheduleId ? { scheduleId: recovery.failedScheduleId } : {}) });
  return (
    <div role="status" className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">Threadsの連携が復旧しました</p>
        <button type="button" aria-label="復旧メッセージを閉じる" onClick={() => setRecovery(null)}>閉じる</button>
      </div>
      <p className="mt-2">予約投稿・データ更新を再開できます。</p>
      {recovery.failedCount === null ? <p className="mt-2">失敗した予約の件数を取得できませんでした。予約一覧をご確認ください。</p> : recovery.failedCount > 0 ? (
        <p className="mt-2">認証切れで失敗した予約が{recovery.failedCount}件あります。自動では再投稿されません。投稿するものは日時を変更して再予約してください。</p>
      ) : null}
      {recovery.failedCount !== 0 && <Link className="mt-3 inline-block font-semibold underline" href={`/${userId}?${review}`}>失敗した予約を確認する</Link>}
    </div>
  );
}
