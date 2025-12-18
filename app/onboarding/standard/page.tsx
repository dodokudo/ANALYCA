'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function OnboardingStandardPage() {
  // Threads
  const [threadsToken, setThreadsToken] = useState('');

  // Instagram
  const [instagramAppId, setInstagramAppId] = useState('');
  const [instagramAppSecret, setInstagramAppSecret] = useState('');
  const [instagramShortToken, setInstagramShortToken] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // バリデーション
    if (!threadsToken.trim()) {
      setError('Threadsアクセストークンを入力してください');
      return;
    }
    if (!instagramAppId.trim() || !instagramAppSecret.trim() || !instagramShortToken.trim()) {
      setError('Instagramの全ての項目を入力してください');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/onboarding/standard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threads: {
            accessToken: threadsToken.trim(),
          },
          instagram: {
            appId: instagramAppId.trim(),
            appSecret: instagramAppSecret.trim(),
            shortToken: instagramShortToken.trim(),
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        // localStorageにユーザーID保存
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('analycaUserId', result.userId);
        }
        // バックグラウンド同期（失敗しても無視）
        if (result.syncPending) {
          fetch('/api/sync/threads/posts', { method: 'GET' }).catch(() => {});
          fetch('/api/sync/instagram/reels', { method: 'GET' }).catch(() => {});
          fetch('/api/sync/instagram/stories', { method: 'GET' }).catch(() => {});
        }
        // ダッシュボードへ遷移
        window.location.href = `/${result.userId}`;
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
    <div className="min-h-screen bg-gradient-to-r from-pink-50/70 via-blue-50/50 to-teal-50/30 py-8 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* ANALYCAロゴ */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">ANALYCA</h1>
            <div className="mt-2 inline-block bg-purple-100 text-purple-700 text-sm font-medium px-3 py-1 rounded-full">
              Standardプラン
            </div>
            <p className="text-gray-600 mt-3">Threads & Instagramインサイトの分析ツール</p>
          </div>

          {/* フォーム */}
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Threads セクション */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                <img src="/threads_logo.png" alt="Threads" className="w-6 h-6" />
                <h2 className="text-lg font-semibold text-gray-900">Threads</h2>
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

            {/* Instagram セクション */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                <svg className="w-6 h-6 text-pink-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                <h2 className="text-lg font-semibold text-gray-900">Instagram</h2>
              </div>

              <div>
                <label htmlFor="instagramAppId" className="block text-sm font-medium text-gray-700 mb-2">
                  App ID
                </label>
                <input
                  type="text"
                  id="instagramAppId"
                  value={instagramAppId}
                  onChange={(e) => setInstagramAppId(e.target.value)}
                  placeholder="1234567890123456"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-gray-900 placeholder-gray-400"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="instagramAppSecret" className="block text-sm font-medium text-gray-700 mb-2">
                  App Secret
                </label>
                <input
                  type="password"
                  id="instagramAppSecret"
                  value={instagramAppSecret}
                  onChange={(e) => setInstagramAppSecret(e.target.value)}
                  placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-gray-900 placeholder-gray-400"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="instagramShortToken" className="block text-sm font-medium text-gray-700 mb-2">
                  短期アクセストークン
                </label>
                <input
                  type="text"
                  id="instagramShortToken"
                  value={instagramShortToken}
                  onChange={(e) => setInstagramShortToken(e.target.value)}
                  placeholder="EAAxxxxxxxxxxxxxxxxx..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-gray-900 placeholder-gray-400"
                  disabled={isLoading}
                />
              </div>

              <a
                href="https://www.notion.so/htex/22b29b1441a9805cac48d5e97355e8ae?source=copy_link#22b29b1441a9805aa52cddcafa3e9421"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                設定方法を見る
              </a>
            </div>

            {/* エラー表示 */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            {/* 送信ボタン */}
            <button
              type="submit"
              disabled={isLoading || !threadsToken.trim() || !instagramAppId.trim() || !instagramAppSecret.trim() || !instagramShortToken.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  );
}
