'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function OnboardingLightPage() {
  const [threadsToken, setThreadsToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!threadsToken.trim()) {
      setError('Threadsアクセストークンを入力してください');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/onboarding/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: threadsToken.trim() }),
      });

      const result = await response.json();

      if (result.success) {
        // localStorageにユーザーID保存
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('analycaUserId', result.userId);
        }
        // 同期APIを実行して完了を待つ
        try {
          setSyncStatus('Threads投稿を同期中...（最大1分）');
          await fetch(`/api/sync/threads/posts?userId=${result.userId}`, { method: 'GET' });

          setSyncStatus('日別メトリクスを同期中...');
          await fetch(`/api/sync/threads/insights?userId=${result.userId}`, { method: 'GET' });

          setSyncStatus('コメントを同期中...');
          await fetch(`/api/sync/threads/comments?userId=${result.userId}`, { method: 'GET' });

          setSyncStatus('プロフィール画像を保存中...');
          await fetch(`/api/sync/profile-pictures?userId=${result.userId}`, { method: 'GET' });

          setSyncStatus('完了！ダッシュボードへ移動します...');
        } catch (syncError) {
          console.warn('Sync API error (continuing anyway):', syncError);
        }
        // 同期完了後にダッシュボードへリダイレクト（replaceで戻るボタン対策）
        window.location.replace(`/${result.userId}?tab=threads`);
      } else {
        setError(result.error || 'セットアップに失敗しました');
      }
    } catch (err) {
      console.error('Onboarding error:', err);
      setError('エラーが発生しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-pink-50/70 via-blue-50/50 to-teal-50/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        {/* ANALYCAロゴ */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ANALYCA</h1>
          <div className="mt-2 inline-block bg-gray-100 text-gray-700 text-sm font-medium px-3 py-1 rounded-full">
            Lightプラン
          </div>
          <p className="text-gray-600 mt-3">Threadsインサイトの分析ツール</p>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Threads セクション */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <img src="/threads_logo.png" alt="Threads" className="w-6 h-6" />
              <h2 className="text-lg font-semibold text-gray-900">Threads</h2>
            </div>

            {/* OAuth連携ボタン */}
            <button
              type="button"
              onClick={() => {
                const clientId = process.env.NEXT_PUBLIC_THREADS_APP_ID || '729490462757265';
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://analyca.jp';
                const redirectUri = encodeURIComponent(`${appUrl}/api/auth/threads/callback`);
                const scope = 'threads_basic,threads_content_publish,threads_manage_insights,threads_manage_replies,threads_read_replies';
                window.location.href = `https://threads.net/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
              }}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-3 disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-.542-1.94-1.5-3.42-2.849-4.4-1.468-1.066-3.37-1.62-5.652-1.639-2.853.02-4.96.908-6.26 2.639C4.743 6.467 4.018 8.818 4 11.982v.014c.018 3.163.743 5.511 2.157 7.222 1.3 1.575 3.405 2.394 6.257 2.438 1.852.018 3.45-.245 4.755-.752 1.434-.555 2.625-1.44 3.54-2.632.873-1.134 1.504-2.56 1.876-4.241l2.04.568c-.452 2.042-1.24 3.805-2.342 5.236-1.147 1.492-2.632 2.653-4.416 3.451-1.622.725-3.497 1.114-5.575 1.15zM12 9.75c-1.243 0-2.25 1.007-2.25 2.25s1.007 2.25 2.25 2.25 2.25-1.007 2.25-2.25-1.007-2.25-2.25-2.25zm6-3c-1.243 0-2.25 1.007-2.25 2.25s1.007 2.25 2.25 2.25 2.25-1.007 2.25-2.25-1.007-2.25-2.25-2.25z"/>
              </svg>
              <span>Threadsアカウントで連携</span>
            </button>

            {/* 区切り線 */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white text-gray-400">または手動でトークンを入力</span>
              </div>
            </div>

            <div>
              <label htmlFor="threadsToken" className="block text-sm font-medium text-gray-700 mb-2">
                アクセストークン
              </label>
              <input
                type="text"
                id="threadsToken"
                value={threadsToken}
                onChange={(e) => setThreadsToken(e.target.value)}
                placeholder="THQWxxxxxxxxxxxxxxxxx..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all text-gray-900 placeholder-gray-400"
                disabled={isLoading}
              />
            </div>

            <a
              href="https://www.notion.so/htex/22b29b1441a9805cac48d5e97355e8ae?source=copy_link#22b29b1441a980a98b3ad49f62025d4f"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              トークンの取得方法を見る
            </a>
          </div>

          {/* エラー表示 */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* 同期ステータス表示 */}
          {syncStatus && (
            <div className="bg-gray-50 border border-gray-200 px-4 py-3 rounded-xl">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-500 border-t-transparent"></div>
                <span className="text-sm text-gray-700 font-medium">{syncStatus}</span>
              </div>
            </div>
          )}

          {/* 送信ボタン */}
          <button
            type="submit"
            disabled={isLoading || !threadsToken.trim()}
            className="w-full bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                セットアップ中...
              </span>
            ) : (
              'セットアップを開始'
            )}
          </button>
        </form>

        {/* フッターリンク */}
        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← トップページに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
