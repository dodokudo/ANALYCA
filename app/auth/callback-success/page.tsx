'use client';

import { useEffect } from 'react';
import { OAUTH_STORAGE_KEY } from '@/lib/oauth-popup';

/**
 * OAuthコールバック成功ページ
 *
 * ポップアップウィンドウ内で表示され、親ウィンドウに認証結果を通知した後、自動的に閉じる。
 * 通信チャネル:
 * 1. postMessage - window.openerが生きている場合（primary）
 * 2. localStorage - COOPでopenerが切断された場合（fallback）
 * どちらも同時に実行し、親側で先に受信した方を使う。
 */
export default function CallbackSuccessPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('userId') || '';
    const tab = params.get('tab') || '';
    const syncing = params.get('syncing') || '';

    if (!userId) {
      window.location.replace('/login');
      return;
    }

    const data = { userId, tab, syncing };

    // Channel 2: localStorage（COOPでopenerが切れていても確実に届く）
    window.localStorage.setItem(OAUTH_STORAGE_KEY, JSON.stringify(data));

    // Channel 1: postMessage（openerが生きていれば即座に届く）
    if (window.opener) {
      try {
        window.opener.postMessage(
          { type: 'oauth-callback', ...data },
          window.location.origin
        );
      } catch {
        // cross-origin access error - localStorageで届くので無視
      }
    }

    // ポップアップを閉じる（window.openで開かれたウィンドウなので閉じられる）
    window.close();

    // window.close()が効かなかった場合（一部ブラウザ）: ダッシュボードにリダイレクト
    // 少し待ってからリダイレクト（親がlocalStorageを読む時間を確保）
    const fallbackTimer = setTimeout(() => {
      window.location.replace(`/${userId}?tab=${tab}&syncing=true`);
    }, 2000);

    return () => clearTimeout(fallbackTimer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="text-center bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <p className="text-gray-700 font-medium">認証完了</p>
        <p className="text-gray-500 text-sm mt-2">
          このウィンドウは自動的に閉じます...
        </p>
      </div>
    </div>
  );
}
