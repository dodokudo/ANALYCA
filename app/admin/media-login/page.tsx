'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function MediaAdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/media/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'ログインできませんでした');
      router.replace('/admin/media');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ログインできませんでした');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-7 flex items-center gap-3">
          <span className="h-9 w-3 -skew-x-12 rounded-sm bg-blue-600" />
          <div><h1 className="text-xl font-black tracking-tight">ANALYCA Media 管理</h1><p className="text-sm text-slate-500">管理者確認</p></div>
        </div>
        <p className="mb-5 text-sm leading-7 text-slate-600">先に管理対象のANALYCAアカウントでログインし、メディア管理用パスワードを入力してください。</p>
        <form onSubmit={submit}>
          <label className="text-sm font-bold text-slate-700">
            管理用パスワード
            <input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
          </label>
          {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
          <button type="submit" disabled={loading} className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-50">{loading ? '確認中…' : '管理画面へ進む'}</button>
        </form>
        <Link href="/login" className="mt-5 block text-center text-sm font-bold text-slate-500">ANALYCAへログイン</Link>
      </section>
    </main>
  );
}
