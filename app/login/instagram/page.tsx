'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { openOAuthPopup, PopupBlockedError } from '@/lib/oauth-popup';
import { safeLocalStorage } from '@/lib/safe-storage';

export default function InstagramLoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');

    if (!error) {
      let userId = safeLocalStorage.getItem('analycaUserId');
      if (!userId) {
        const match = document.cookie.match(/(?:^|;\s*)analycaUserId=([^;]+)/);
        if (match) {
          userId = decodeURIComponent(match[1]);
          safeLocalStorage.setItem('analycaUserId', userId);
        }
      }
      if (userId) {
        setIsRedirecting(true);
        router.push(`/${userId}?tab=instagram`);
        return;
      }
    }

    if (error) {
      setAuthError(decodeURIComponent(error));
      window.history.replaceState({}, '', '/login/instagram');
    }
  }, [router]);

  const handleInstagramLogin = async () => {
    setIsLoading(true);
    const clientId = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID || '1238454094361851';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://analyca.jp';
    const redirectUri = encodeURIComponent(`${appUrl}/api/auth/instagram/callback`);
    const scope = 'instagram_business_basic,instagram_business_manage_insights';
    const currentUserId = safeLocalStorage.getItem('analycaUserId');
    const stateParam = currentUserId
      ? `&state=${encodeURIComponent(JSON.stringify({ pendingUserId: currentUserId }))}`
      : '';
    const oauthUrl = `https://api.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}${stateParam}`;

    try {
      const { userId } = await openOAuthPopup(oauthUrl);
      safeLocalStorage.setItem('analycaUserId', userId);
      router.push(`/${userId}?tab=instagram&syncing=true&auth=instagram_complete`);
    } catch (err) {
      if (err instanceof PopupBlockedError) {
        window.location.href = oauthUrl;
        return;
      }
      setIsLoading(false);
    }
  };

  if (isRedirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">ダッシュボードへ移動中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ANALYCA</h1>
          <p className="text-gray-600 mt-2">Instagramアカウントでログイン</p>
        </div>

        {authError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            認証エラー: {authError}
          </div>
        )}

        <button
          onClick={() => setShowModal(true)}
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-3 disabled:opacity-50"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
          {isLoading ? (
            <span>Instagramへリダイレクト中...</span>
          ) : (
            <span>Instagramでログイン</span>
          )}
        </button>

        <p className="text-xs text-gray-500 mt-4 text-center">
          Instagramアカウントを連携して分析を始めましょう
        </p>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">許諾画面で必ず全項目をONにしてください</h2>
                <p className="text-sm text-gray-600 mt-1">最重要のお願いです。必ずお読みください。</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-gray-800 space-y-2">
              <p>次に表示されるInstagramの許諾画面で、<strong>全てのトグルをONにしてから「許可」を押してください</strong>。</p>
              <p>特に<strong>「インサイトの取得」のトグル</strong>がOFFのままだと、リール・ストーリーの再生数やリーチ数が一切取得できず、ダッシュボードが機能しません。</p>
              <p className="text-xs text-gray-600 pt-2 border-t border-amber-200">※ デフォルトでOFFになっている場合があります。必ず目で確認してONにしてください。</p>
            </div>

            <button
              onClick={() => {
                setShowModal(false);
                handleInstagramLogin();
              }}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 disabled:opacity-50"
            >
              {isLoading ? 'リダイレクト中...' : 'ログインに進む'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
