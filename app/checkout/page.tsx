'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Script from 'next/script';
import LoadingScreen from '@/components/LoadingScreen';
import AnalycaLogo from '@/components/AnalycaLogo';
import { PLANS } from '@/lib/univapay/plans';
import * as gtag from '@/lib/gtag';

declare global {
  interface Window {
    UnivapayCheckout: {
      submit: (iframe: Element) => Promise<{ id: string; [key: string]: unknown }>;
    };
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error) || 'Unknown error';
  } catch {
    return 'Unknown error';
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams?.get('plan') || '';
  const plan = PLANS[planId];
  const isYearly = plan?.yearly === true;

  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appId, setAppId] = useState<string | null>(null);
  const [refCode, setRefCode] = useState<string>('');
  const formRef = useRef<HTMLFormElement>(null);

  // UnivaPay設定を取得 + refコード読み込み
  useEffect(() => {
    fetch('/api/payment/config')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.config?.appId) {
          setAppId(data.config.appId);
        }
      })
      .catch(err => {
        console.error('Failed to load payment config:', err);
        setError('決済設定の読み込みに失敗しました');
      });

    // localStorageから紹介コードを読み込み
    const savedRef = window.localStorage.getItem('analyca_ref');
    if (savedRef) {
      setRefCode(savedRef);
    }
  }, []);

  // プランが見つからない場合
  if (!plan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md">
          <h2 className="text-xl font-bold text-gray-800 mb-4">プランが見つかりません</h2>
          <p className="text-gray-600 mb-6">有効なプランを選択してください。</p>
          <button
            onClick={() => router.push('/pricing')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            プラン選択に戻る
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const iframe = document.querySelector('#univapay-checkout iframe');
    if (!iframe || !window.UnivapayCheckout) {
      setError('決済フォームの準備ができていません。ページを再読み込みしてください。');
      return;
    }

    setProcessing(true);

    try {
      gtag.event('add_payment_info', {
        value: plan.price,
        currency: 'JPY',
        plan_id: planId,
      });

      console.log('[CHECKOUT] Submitting UnivaPay form...');
      const data = await window.UnivapayCheckout.submit(iframe);
      console.log('[CHECKOUT] Token received:', safeStringify(data));

      // トークンIDを取得（submit()の返り値の構造に対応）
      const d = data as Record<string, unknown>;
      const tokenId =
        asString(d?.token) ||
        asString(d?.transactionToken) ||
        asString(d?.id) ||
        asString(d?.transactionTokenId);
      const email = asString((d?.tokenData as Record<string, unknown> | undefined)?.email);
      console.log('[CHECKOUT] Raw data:', safeStringify(data), 'Resolved tokenId:', tokenId, 'email:', email);

      if (!tokenId) {
        console.error('[CHECKOUT] No token ID found. Keys:', Object.keys(d || {}));
        setError(`決済トークンの取得に失敗しました。返り値: ${safeStringify(data).substring(0, 200)}`);
        setProcessing(false);
        return;
      }

      // トークン取得成功 → サブスク作成
      // UTMパラメータをlocalStorageから取得して送信
      const utmSource = window.localStorage.getItem('analyca_utm_source') || '';
      const utmMedium = window.localStorage.getItem('analyca_utm_medium') || '';
      const utmCampaign = window.localStorage.getItem('analyca_utm_campaign') || '';
      const utmContent = window.localStorage.getItem('analyca_utm_content') || '';
      const existingUserId = searchParams?.get('userId') || window.localStorage.getItem('analycaUserId') || '';

      console.log('[CHECKOUT] Creating subscription with token:', tokenId, 'plan:', planId);
      const response = await fetch('/api/payment/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionTokenId: tokenId,
          planId: planId,
          refCode: refCode || undefined,
          utm_source: utmSource || undefined,
          utm_medium: utmMedium || undefined,
          utm_campaign: utmCampaign || undefined,
          utm_content: utmContent || undefined,
          email: email || undefined,
          userId: existingUserId || undefined,
        }),
      });

      console.log('[CHECKOUT] Subscribe API response status:', response.status);
      const result = await response.json();
      console.log('[CHECKOUT] Subscribe API result:', safeStringify(result));

      if (result.success) {
        // GA4: purchase イベント
        gtag.event('purchase', {
          value: plan.price,
          currency: 'JPY',
          plan_id: planId,
        });
        router.push(result.onboardingPath);
      } else {
        setError(result.error || '課金処理に失敗しました');
        setProcessing(false);
      }
    } catch (err) {
      const errorDetail = safeErrorMessage(err);
      console.error('[CHECKOUT] Payment error:', errorDetail, err);
      setError(`決済エラー: ${errorDetail}`);
      setProcessing(false);
    }
  };

  const formReady = scriptLoaded && !!appId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      {/* UnivaPay Script */}
      <Script
        src="https://widget.univapay.com/client/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />

      {/* ヘッダー */}
      <header className="border-b border-gray-100 bg-white/90 backdrop-blur-sm">
        <div className="max-w-lg mx-auto px-4 py-4">
          <AnalycaLogo size="md" showText />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 md:py-12">
        {/* 注文概要 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-800 text-lg">{plan.name}プラン</h2>
              <p className="text-sm text-gray-500">{plan.subtitle}</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-gray-800">
                ¥{plan.price.toLocaleString()}
              </span>
              <p className="text-xs text-gray-400">税込 / {isYearly ? '年' : '月'}</p>
            </div>
          </div>

          {/* 7日間無料トライアル表示 */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mt-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-emerald-800">7日間無料体験</p>
            </div>
            <p className="text-xs text-emerald-600 mt-1 ml-7">
              今日から7日間は無料。期間中はいつでもキャンセルできます。
            </p>
          </div>

          {(() => {
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 7);
            const formatted = trialEndDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
            return (
              <div className="border-t border-gray-100 pt-3 mt-3 space-y-1">
                <p className="text-sm text-gray-600">8日目から{isYearly ? '年額' : '月額'} ¥{plan.price.toLocaleString()}（税込）・自動更新</p>
                <p className="text-xs text-gray-400">初回課金日: {formatted}</p>
              </div>
            );
          })()}

          {/* 紹介コード */}
          <div className="border-t border-gray-100 pt-3 mt-3">
            <label htmlFor="refCode" className="text-xs text-gray-500">紹介コード（任意）</label>
            <input
              type="text"
              id="refCode"
              value={refCode}
              onChange={(e) => setRefCode(e.target.value.trim())}
              placeholder="紹介コードがあれば入力"
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* カード入力フォーム */}
        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">カード情報</h2>
              <div className="flex items-center gap-1.5">
                <img src="/cards/visa.svg" alt="Visa" className="h-7 w-auto" />
                <img src="/cards/mastercard.svg" alt="Mastercard" className="h-7 w-auto" />
                <img src="/cards/jcb.svg" alt="JCB" className="h-7 w-auto" />
                <img src="/cards/amex.svg" alt="AMEX" className="h-7 w-auto" />
              </div>
            </div>

            {/* UnivaPayインラインフォーム（data属性方式） */}
            <div id="univapay-checkout" className="min-h-[350px] relative">
              {appId ? (
                <span
                  data-app-id={appId}
                  data-checkout="token"
                  data-amount={plan.price}
                  data-currency="jpy"
                  data-inline="true"
                  data-cvv-authorize="true"
                  data-require-phone-number="false"
                  data-phone-number="00000000000"
                  data-inline-item-style="padding: 10px 0; border-bottom: none;"
                  data-inline-item-label-style="color: #4b5563; font-size: 13px; font-weight: 600; margin-bottom: 6px;"
                  data-inline-text-field-style="border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; font-size: 15px; background: #fafafa; width: 100%; box-sizing: border-box;"
                  data-inline-field-focus-style="border-color: #8b5cf6; background: #fff; box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);"
                  data-inline-field-invalid-style="border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-200 border-t-purple-500"></div>
                  <p className="text-sm">読み込み中...</p>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!formReady || processing}
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-400 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 text-lg"
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                  処理中...
                </span>
              ) : (
                '無料で始める（7日間）'
              )}
            </button>

            <p className="text-center text-xs text-gray-500 mt-3">
              7日間無料。期間中はいつでもキャンセル可能。8日目から{isYearly ? '年額' : '月額'}¥{plan.price.toLocaleString()}
            </p>

            <div className="flex items-center justify-center gap-2 mt-3">
              <svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <p className="text-xs text-gray-400">
                SSL暗号化通信で安全に処理されます
              </p>
            </div>
          </div>
        </form>

        {/* 戻るリンク */}
        <div className="text-center mt-6">
          <button
            onClick={() => router.push('/pricing')}
            className="text-gray-400 hover:text-gray-600 text-sm transition-colors"
          >
            ← プラン選択に戻る
          </button>
        </div>
      </main>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<LoadingScreen message="読み込み中" />}>
      <CheckoutContent />
    </Suspense>
  );
}
