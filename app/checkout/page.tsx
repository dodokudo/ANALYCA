'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Script from 'next/script';
import LoadingScreen from '@/components/LoadingScreen';
import AnalycaLogo from '@/components/AnalycaLogo';
import { PLANS } from '@/lib/univapay/plans';

declare global {
  interface Window {
    UnivapayCheckout: {
      create: (config: Record<string, unknown>) => {
        open: () => void;
        close: () => void;
      };
      submit: () => void;
    };
  }
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams?.get('plan') || '';
  const plan = PLANS[planId];

  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [univaPayConfig, setUnivaPayConfig] = useState<{ appId: string } | null>(null);
  const checkoutRef = useRef<{ open: () => void; close: () => void } | null>(null);
  const openedRef = useRef(false);

  // UnivaPay設定を取得
  useEffect(() => {
    fetch('/api/payment/config')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUnivaPayConfig(data.config);
        }
      })
      .catch(err => {
        console.error('Failed to load payment config:', err);
        setError('決済設定の読み込みに失敗しました');
      });
  }, []);

  // 準備ができたら自動でチェックアウトモーダルを開く
  const openCheckout = useCallback(() => {
    if (!scriptLoaded || !univaPayConfig || !plan || openedRef.current) return;
    openedRef.current = true;

    try {
      const checkout = window.UnivapayCheckout.create({
        appId: univaPayConfig.appId,
        checkout: 'token',
        amount: plan.price,
        currency: 'JPY',
        cvvAuthorize: true,
        subscriptionPeriod: 'monthly',
        metadata: {
          planId: planId,
          planName: plan.name,
        },
        onSuccess: async (result: { id: string; type: string }) => {
          setProcessing(true);
          try {
            const response = await fetch('/api/payment/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                transactionTokenId: result.id,
                planId: planId,
              }),
            });
            const data = await response.json();
            if (data.success) {
              router.push(data.onboardingPath);
            } else {
              setError(data.error || '課金処理に失敗しました');
              setProcessing(false);
            }
          } catch (err) {
            console.error('Subscription error:', err);
            setError('課金処理に失敗しました');
            setProcessing(false);
          }
        },
        onError: (err: { message?: string }) => {
          console.error('Payment error:', err);
          setError(err.message || '決済に失敗しました');
          setProcessing(false);
          openedRef.current = false;
        },
        onCancel: () => {
          setProcessing(false);
          openedRef.current = false;
        },
      });

      checkout.open();
      checkoutRef.current = checkout;
    } catch (err) {
      console.error('Checkout error:', err);
      setError('決済システムの初期化に失敗しました');
      openedRef.current = false;
    }
  }, [scriptLoaded, univaPayConfig, plan, planId, router]);

  useEffect(() => {
    openCheckout();
  }, [openCheckout]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      {/* UnivaPay Script */}
      <Script
        src="https://widget.univapay.com/client/checkout.js"
        onLoad={() => setScriptLoaded(true)}
      />

      {/* ヘッダー */}
      <header className="border-b border-gray-100 bg-white/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <AnalycaLogo size="md" showText />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-12 md:py-20">
        {/* 注文概要カード */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-gray-800 text-lg">{plan.name}プラン</h2>
              <p className="text-sm text-gray-500">{plan.subtitle}</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-gray-800">
                ¥{plan.price.toLocaleString()}
              </span>
              <p className="text-xs text-gray-400">税込 / 月</p>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-4 text-xs text-gray-400">
            月額・自動更新 ・ 次回請求日: 1ヶ月後
          </div>
        </div>

        {/* ステータス表示 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          {processing ? (
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-200 border-t-purple-500"></div>
              <p className="text-gray-600 font-medium">サブスクリプションを作成中...</p>
              <p className="text-sm text-gray-400">しばらくお待ちください</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <p className="text-red-600 font-medium mb-1">エラーが発生しました</p>
                <p className="text-sm text-gray-500">{error}</p>
              </div>
              <button
                onClick={() => {
                  setError(null);
                  openCheckout();
                }}
                className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium"
              >
                もう一度試す
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-200 border-t-purple-500"></div>
              <p className="text-gray-600 font-medium">お支払い情報の入力画面を準備中...</p>
              <p className="text-sm text-gray-400">まもなく表示されます</p>
            </div>
          )}
        </div>

        {/* 戻るリンク */}
        <div className="text-center mt-6">
          <button
            onClick={() => router.push('/pricing')}
            className="text-gray-400 hover:text-gray-600 text-sm transition-colors"
          >
            ← プラン選択に戻る
          </button>
        </div>

        {/* セキュリティバッジ */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <p className="text-xs text-gray-400">
            SSL暗号化通信で安全に処理されます
          </p>
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
