'use client';

import { useEffect, useState } from 'react';

// Facebook SDK型定義
declare global {
  interface Window {
    FB: {
      login: (callback: (response: unknown) => void, options?: { scope: string }) => void;
    };
  }
}

export default function LoginPage() {
  const [isInstagramLoading, setIsInstagramLoading] = useState(false);
  const [isThreadsLoading, setIsThreadsLoading] = useState(false);
  const [storedUserId, setStoredUserId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedUserId = window.localStorage.getItem('analycaUserId');
    if (savedUserId) {
      setStoredUserId(savedUserId);
    }
  }, []);

  const persistUserId = (userId: string) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('analycaUserId', userId);
    setStoredUserId(userId);
  };

  const handleInstagramLogin = () => {
    setIsInstagramLoading(true);

    // Instagram用のApp IDで再初期化
    if (window.FB) {
      const instagramAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '1418141859432290';
      // @ts-expect-error - FB.init can be called multiple times
      window.FB.init({
        appId: instagramAppId,
        cookie: true,
        xfbml: true,
        version: 'v23.0'
      });
    }

    // Instagram Login
    window.FB.login((response: unknown) => {
      if (response && typeof response === 'object' && 'authResponse' in response) {
        const authResponse = response.authResponse as { accessToken: string };
        const accessToken = authResponse.accessToken;

        // サーバーに送信してダッシュボード作成
        fetch('/api/create-dashboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken, type: 'instagram', userId: storedUserId ?? undefined })
        }).then(async (response) => {
          const result = await response.json();

          if (result.success) {
            persistUserId(result.userId);

            // バックグラウンドで追加データの同期を開始（レスポンスを待たない）
            if (result.syncPending) {
              fetch(`/api/sync/instagram/reels?userId=${result.userId}`, { method: 'GET' }).catch(() => {});
              fetch(`/api/sync/instagram/stories?userId=${result.userId}`, { method: 'GET' }).catch(() => {});
            }

            // ダッシュボードにリダイレクト（同期中フラグ付き）
            window.location.href = `/${result.userId}?tab=instagram&syncing=true`;
          } else {
            alert(`エラー: ${result.error}`);
            setIsInstagramLoading(false);
          }
        }).catch((error) => {
          console.error('Instagram dashboard creation failed:', error);
          alert('ダッシュボード作成に失敗しました');
          setIsInstagramLoading(false);
        });
      } else {
        alert('ログインに失敗しました');
        setIsInstagramLoading(false);
      }
    }, {
      scope: 'instagram_basic,pages_show_list,instagram_manage_insights'
    });
  };

  const handleThreadsLogin = () => {
    setIsThreadsLoading(true);

    // Threads用のApp IDで再初期化
    if (window.FB) {
      const threadsAppId = process.env.NEXT_PUBLIC_THREADS_APP_ID || '729490462757265';
      // @ts-expect-error - FB.init can be called multiple times
      window.FB.init({
        appId: threadsAppId,
        cookie: true,
        xfbml: true,
        version: 'v23.0'
      });
    }

    // Threads Login
    window.FB.login((response: unknown) => {
      if (response && typeof response === 'object' && 'authResponse' in response) {
        const authResponse = response.authResponse as { accessToken: string };
        const accessToken = authResponse.accessToken;

        // サーバーに送信してダッシュボード作成
        fetch('/api/create-dashboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken, type: 'threads', userId: storedUserId ?? undefined })
        }).then(async (response) => {
          const result = await response.json();

          if (result.success) {
            persistUserId(result.userId);

            // バックグラウンドで追加データの同期を開始（レスポンスを待たない）
            if (result.syncPending) {
              fetch(`/api/sync/threads/posts?userId=${result.userId}`, { method: 'GET' }).catch(() => {});
            }

            // ダッシュボードにリダイレクト（同期中フラグ付き）
            window.location.href = `/${result.userId}?tab=threads&syncing=true`;
          } else {
            alert(`エラー: ${result.error}`);
            setIsThreadsLoading(false);
          }
        }).catch((error) => {
          console.error('Threads dashboard creation failed:', error);
          alert('ダッシュボード作成に失敗しました');
          setIsThreadsLoading(false);
        });
      } else {
        alert('ログインに失敗しました');
        setIsThreadsLoading(false);
      }
    }, {
      scope: 'threads_basic,threads_content_publish,threads_manage_insights,threads_manage_replies,threads_read_replies'
    });
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
              <span>Instagram設定中...</span>
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
              <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-.542-1.94-1.5-3.42-2.849-4.4-1.468-1.066-3.37-1.62-5.652-1.639-2.853.02-4.96.908-6.26 2.639C4.743 6.467 4.018 8.818 4 11.982v.014c.018 3.163.743 5.511 2.157 7.222 1.3 1.575 3.405 2.394 6.257 2.438 1.852.018 3.45-.245 4.755-.752 1.434-.555 2.625-1.44 3.54-2.632.873-1.134 1.504-2.56 1.876-4.241l2.04.568c-.452 2.042-1.24 3.805-2.342 5.236-1.147 1.492-2.632 2.653-4.416 3.451-1.622.725-3.497 1.114-5.575 1.15zM12 9.75c-1.243 0-2.25 1.007-2.25 2.25s1.007 2.25 2.25 2.25 2.25-1.007 2.25-2.25-1.007-2.25-2.25-2.25zm6-3c-1.243 0-2.25 1.007-2.25 2.25s1.007 2.25 2.25 2.25 2.25-1.007 2.25-2.25-1.007-2.25-2.25-2.25z"/>
            </svg>
            {isThreadsLoading ? (
              <span>Threads設定中...</span>
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

      {/* Facebook SDK - 動的に初期化 */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.fbAsyncInit = function() {
              // デフォルトはInstagram用のApp IDで初期化
              FB.init({
                appId: '${process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '1418141859432290'}',
                cookie: true,
                xfbml: true,
                version: 'v23.0'
              });
            };
          `
        }}
      />
      <script async defer crossOrigin="anonymous" src="https://connect.facebook.net/ja_JP/sdk.js" />
    </div>
  );
}
