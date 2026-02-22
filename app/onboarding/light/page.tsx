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
                <path d="M17.688 10.937c-.03-.014-.062-.027-.092-.04-.185-3.413-2.05-5.367-5.182-5.387h-.043c-1.873 0-3.431.799-4.39 2.255l1.722 1.181c.716-1.087 1.84-1.319 2.668-1.319h.029c1.031.007 1.809.307 2.313.891.366.426.612 1.014.733 1.756-.914-.155-1.903-.203-2.96-.142-2.978.171-4.891 1.908-4.764 4.321.065 1.224.675 2.277 1.717 2.965.881.581 2.015.866 3.195.801 1.557-.085 2.779-.679 3.631-1.764.647-.823 1.058-1.884 1.239-3.224.743.448 1.293 1.041 1.612 1.755.542 1.214.574 3.206-1.207 4.988-1.555 1.555-3.425 2.226-6.072 2.249-2.934-.025-5.156-.959-6.606-2.777-1.355-1.699-2.06-4.14-2.094-7.266.034-3.125.739-5.567 2.094-7.266 1.45-1.818 3.672-2.752 6.606-2.777 2.954.025 5.186.964 6.643 2.797.718.903 1.246 2.018 1.58 3.333l1.964-.469c-.39-1.536-1.031-2.875-1.923-3.994-1.836-2.304-4.553-3.486-8.074-3.518h-.013c-3.771.033-6.444 1.237-8.197 3.416-1.69 2.101-2.565 5.057-2.602 8.79v.006c.037 3.733.912 6.688 2.602 8.789 1.753 2.179 4.426 3.383 8.197 3.416h.013c3.088-.025 5.448-.854 7.43-2.608 2.261-2.003 2.644-4.767 1.827-6.599-.588-1.316-1.683-2.348-3.23-3.056zm-5.684 6.314c-1.307.071-2.665-.514-2.759-1.793-.07-.951.674-2.012 2.954-2.143.259-.015.512-.022.762-.022.782 0 1.515.075 2.177.222-.248 3.02-1.783 3.665-3.134 3.736z"/>
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
