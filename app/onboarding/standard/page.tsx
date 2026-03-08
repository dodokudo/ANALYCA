'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { openOAuthPopup, PopupBlockedError } from '@/lib/oauth-popup';

export default function OnboardingStandardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>}>
      <OnboardingStandardContent />
    </Suspense>
  );
}

function OnboardingStandardContent() {
  const searchParams = useSearchParams();
  const userId = searchParams?.get('userId') || '';
  const [threadsConnected, setThreadsConnected] = useState(false);
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [connectedUserId, setConnectedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleThreadsOAuth = async () => {
    setError(null);
    const clientId = process.env.NEXT_PUBLIC_THREADS_APP_ID || '729490462757265';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://analyca.jp';
    const redirectUri = encodeURIComponent(`${appUrl}/api/auth/threads/callback`);
    const scope = 'threads_basic,threads_content_publish,threads_manage_insights,threads_manage_replies,threads_read_replies';
    const targetUserId = connectedUserId || userId;
    const state = targetUserId ? encodeURIComponent(JSON.stringify({ pendingUserId: targetUserId })) : '';
    const stateParam = state ? `&state=${state}` : '';
    const oauthUrl = `https://threads.net/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code${stateParam}`;

    try {
      const { userId: returnedUserId } = await openOAuthPopup(oauthUrl);
      window.localStorage.setItem('analycaUserId', returnedUserId);
      setConnectedUserId(returnedUserId);
      setThreadsConnected(true);

      // 両方連携済みならダッシュボードへ
      if (instagramConnected) {
        window.location.replace(`/${returnedUserId}?tab=threads&syncing=true&auth=threads_complete`);
      }
    } catch (err) {
      if (err instanceof PopupBlockedError) {
        window.location.href = oauthUrl;
        return;
      }
      setError('Threads認証がキャンセルされました。もう一度お試しください。');
    }
  };

  const handleInstagramOAuth = async () => {
    setError(null);
    const clientId = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID || '1238454094361851';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://analyca.jp';
    const redirectUri = encodeURIComponent(`${appUrl}/api/auth/instagram/callback`);
    const scope = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish';
    const targetUserId = connectedUserId || userId;
    const state = targetUserId ? encodeURIComponent(JSON.stringify({ pendingUserId: targetUserId })) : '';
    const stateParam = state ? `&state=${state}` : '';
    const oauthUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code${stateParam}`;

    try {
      const { userId: returnedUserId } = await openOAuthPopup(oauthUrl);
      window.localStorage.setItem('analycaUserId', returnedUserId);
      setConnectedUserId(returnedUserId);
      setInstagramConnected(true);

      // 両方連携済みならダッシュボードへ
      if (threadsConnected) {
        window.location.replace(`/${returnedUserId}?tab=instagram&syncing=true&auth=instagram_complete`);
      }
    } catch (err) {
      if (err instanceof PopupBlockedError) {
        window.location.href = oauthUrl;
        return;
      }
      setError('Instagram認証がキャンセルされました。もう一度お試しください。');
    }
  };

  const bothConnected = threadsConnected && instagramConnected;

  const handleGoToDashboard = () => {
    if (connectedUserId) {
      window.location.replace(`/${connectedUserId}?tab=threads&syncing=true`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-pink-50/70 via-blue-50/50 to-teal-50/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
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
          <p className="text-gray-600 mt-3">両方のアカウントを連携して分析を開始</p>
        </div>

        <div className="space-y-4">
          {/* Threads OAuth */}
          <button
            type="button"
            onClick={handleThreadsOAuth}
            disabled={threadsConnected}
            className={`w-full font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-3 ${
              threadsConnected
                ? 'bg-green-100 text-green-800 cursor-default'
                : 'bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white'
            }`}
          >
            {threadsConnected ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Threads 連携済み</span>
              </>
            ) : (
              <>
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z"/>
                </svg>
                <span>Threadsアカウントで連携</span>
              </>
            )}
          </button>

          {/* Instagram OAuth */}
          <button
            type="button"
            onClick={handleInstagramOAuth}
            disabled={instagramConnected}
            className={`w-full font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-3 ${
              instagramConnected
                ? 'bg-green-100 text-green-800 cursor-default'
                : 'bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white'
            }`}
          >
            {instagramConnected ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Instagram 連携済み</span>
              </>
            ) : (
              <>
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                <span>Instagramアカウントで連携</span>
              </>
            )}
          </button>

          {/* 両方連携済み → ダッシュボードへ */}
          {bothConnected && (
            <button
              type="button"
              onClick={handleGoToDashboard}
              className="w-full bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-600 hover:to-emerald-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200"
            >
              ダッシュボードへ
            </button>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {!bothConnected && (
            <p className="text-xs text-gray-500 text-center">
              Standardプランでは両方のアカウント連携が必要です。<br />
              連携後、自動的にデータの同期が開始されます。
            </p>
          )}

          {/* 片方だけ連携してダッシュボードに行きたい場合 */}
          {(threadsConnected || instagramConnected) && !bothConnected && connectedUserId && (
            <button
              type="button"
              onClick={handleGoToDashboard}
              className="w-full text-sm text-gray-500 hover:text-gray-700 underline"
            >
              あとで連携する（ダッシュボードへ）
            </button>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← トップページに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
