'use client';

import { useEffect, useState } from 'react';

export default function LoginPage() {
  const [isInstagramLoading, setIsInstagramLoading] = useState(false);
  const [isThreadsLoading, setIsThreadsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // OAuth エラーメッセージ表示
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error) {
      setAuthError(decodeURIComponent(error));
      // URLからerrorパラメータを削除
      window.history.replaceState({}, '', '/login');
    }

    // OAuth完了後のlocalStorage保存
    const auth = params.get('auth');
    const pathUserId = window.location.pathname.split('/')[1];
    if (auth && pathUserId) {
      window.localStorage.setItem('analycaUserId', pathUserId);
    }
  }, []);

  const handleInstagramLogin = () => {
    setIsInstagramLoading(true);

    // Instagram Login (OAuth 2.0 Authorization Code Flow)
    const clientId = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID || '1238454094361851';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://analyca.jp';
    const redirectUri = encodeURIComponent(`${appUrl}/api/auth/instagram/callback`);
    const scope = 'instagram_business_basic,instagram_business_manage_insights';

    window.location.href = `https://api.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
  };

  const handleThreadsLogin = () => {
    setIsThreadsLoading(true);

    // Threads OAuth 2.0 Authorization Code Flow
    const clientId = process.env.NEXT_PUBLIC_THREADS_APP_ID || '729490462757265';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://analyca.jp';
    const redirectUri = encodeURIComponent(`${appUrl}/api/auth/threads/callback`);
    const scope = 'threads_basic,threads_content_publish,threads_manage_insights,threads_manage_replies,threads_read_replies';

    window.location.href = `https://threads.net/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        {/* ANALYCAロゴ */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ANALYCA</h1>
          <p className="text-gray-600 mt-2">Instagram & Threadsデータを自動分析</p>
        </div>

        {/* OAuthエラー表示 */}
        {authError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            認証エラー: {authError}
          </div>
        )}

        {/* ログインボタン */}
        <div className="space-y-4">
          {/* Instagramログインボタン */}
          <button
            onClick={handleInstagramLogin}
            disabled={isInstagramLoading || isThreadsLoading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-3 disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            {isInstagramLoading ? (
              <span>Instagramへリダイレクト中...</span>
            ) : (
              <span>Instagramでログイン</span>
            )}
          </button>

          {/* Threadsログインボタン */}
          <button
            onClick={handleThreadsLogin}
            disabled={isInstagramLoading || isThreadsLoading}
            className="w-full bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-3 disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.688 10.937c-.03-.014-.062-.027-.092-.04-.185-3.413-2.05-5.367-5.182-5.387h-.043c-1.873 0-3.431.799-4.39 2.255l1.722 1.181c.716-1.087 1.84-1.319 2.668-1.319h.029c1.031.007 1.809.307 2.313.891.366.426.612 1.014.733 1.756-.914-.155-1.903-.203-2.96-.142-2.978.171-4.891 1.908-4.764 4.321.065 1.224.675 2.277 1.717 2.965.881.581 2.015.866 3.195.801 1.557-.085 2.779-.679 3.631-1.764.647-.823 1.058-1.884 1.239-3.224.743.448 1.293 1.041 1.612 1.755.542 1.214.574 3.206-1.207 4.988-1.555 1.555-3.425 2.226-6.072 2.249-2.934-.025-5.156-.959-6.606-2.777-1.355-1.699-2.06-4.14-2.094-7.266.034-3.125.739-5.567 2.094-7.266 1.45-1.818 3.672-2.752 6.606-2.777 2.954.025 5.186.964 6.643 2.797.718.903 1.246 2.018 1.58 3.333l1.964-.469c-.39-1.536-1.031-2.875-1.923-3.994-1.836-2.304-4.553-3.486-8.074-3.518h-.013c-3.771.033-6.444 1.237-8.197 3.416-1.69 2.101-2.565 5.057-2.602 8.79v.006c.037 3.733.912 6.688 2.602 8.789 1.753 2.179 4.426 3.383 8.197 3.416h.013c3.088-.025 5.448-.854 7.43-2.608 2.261-2.003 2.644-4.767 1.827-6.599-.588-1.316-1.683-2.348-3.23-3.056zm-5.684 6.314c-1.307.071-2.665-.514-2.759-1.793-.07-.951.674-2.012 2.954-2.143.259-.015.512-.022.762-.022.782 0 1.515.075 2.177.222-.248 3.02-1.783 3.665-3.134 3.736z"/>
            </svg>
            {isThreadsLoading ? (
              <span>Threadsへリダイレクト中...</span>
            ) : (
              <span>Threadsでログイン</span>
            )}
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-4 text-center">
          それぞれのボタンでログインすると、<br />
          InstagramまたはThreadsのデータを取得します
        </p>
      </div>
    </div>
  );
}
