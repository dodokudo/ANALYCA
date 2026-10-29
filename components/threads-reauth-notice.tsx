import Link from 'next/link';
import { THREADS_REAUTH_MESSAGE } from '@/lib/threads-auth-error';

export function ThreadsReauthNotice() {
  return (
    <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-semibold">Threadsへの再ログインが必要です</p>
      <p className="mt-2">{THREADS_REAUTH_MESSAGE}</p>
      <p className="mt-2">編集中の文章はコピーして控えてから進んでください。失敗した予約投稿は、再ログイン後に確認・再予約してください。</p>
      <Link href="/login/threads" className="mt-3 inline-block rounded-lg bg-gray-900 px-4 py-2 font-semibold text-white">Threadsで再ログイン</Link>
    </div>
  );
}
