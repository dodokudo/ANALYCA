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
  const [formReady, setFormReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [univaPayConfig, setUnivaPayConfig] = useState<{ appId: string } | null>(null);
  const checkoutRef = useRef<{ open: () => void; close: () => void } | null>(null);

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

  // カードフォームをページ読み込み時に自動表示
  const initCheckout = useCallback(() => {
    if (!scriptLoaded || !univaPayConfig || !plan || checkoutRef.current) return;

    try {
      const checkout = window.UnivapayCheckout.create({
        appId: univaPayConfig.appId,
        checkout: 'token',
        amount: plan.price,
        currency: 'JPY',
        cvvAuthorize: true,
        inline: true,
        inlineTarget: '#univapay-inline-form',
        // スタイル — iframeの中に適用されるCSS
        inlineItemStyle: 'padding: 14px 0; border-bottom: none; margin-bottom: 4px;',
        inlineItemLabelStyle: 'color: #4b5563; font-size: 13px; font-weight: 600; letter-spacing: 0.025em; margin-bottom: 6px;',
        inlineFieldStyle: 'border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; font-size: 15px; background: #fafafa; transition: border-color 0.2s; outline: none;',
        inlineFieldFocusStyle: 'border-color: #8b5cf6; background: #fff; box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);',
        subscriptionPeriod: 'monthly',
        metadata: {
          planId: planId,
          planName: plan.name,
        },
        onSuccess: async (result: { id: string; type: string }) => {
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
        },
        onCancel: () => {
          setProcessing(false);
        },
      });

      checkout.open();
      checkoutRef.current = checkout;
      setFormReady(true);
    } catch (err) {
      console.error('Checkout init error:', err);
      setError('決済システムの初期化に失敗しました');
    }
  }, [scriptLoaded, univaPayConfig, plan, planId, router]);

  useEffect(() => {
    initCheckout();
  }, [initCheckout]);

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

  const handlePayment = () => {
    if (!formReady) {
      setError('決済システムの準備ができていません');
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      window.UnivapayCheckout.submit();
    } catch (err) {
      console.error('Submit error:', err);
      setError('決済の送信に失敗しました');
      setProcessing(false);
    }
  };

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

      <main className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        {/* 注文概要（コンパクト） */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-800">{plan.name}プラン</h2>
              <p className="text-sm text-gray-500">{plan.subtitle}・月額</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-gray-800">
                ¥{plan.price.toLocaleString()}
              </span>
              <p className="text-xs text-gray-400">税込 / 月</p>
            </div>
          </div>
        </div>

        {/* 決済フォーム */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          <h2 className="text-lg font-bold text-gray-800 mb-1">お支払い情報</h2>
          <p className="text-sm text-gray-400 mb-6">カード情報を入力してください</p>

          {/* UnivaPayインラインフォーム */}
          <div
            id="univapay-inline-form"
            className="mb-6 min-h-[280px] [&>iframe]:!border-none [&>iframe]:!w-full"
          >
            {!formReady && (
              <div className="flex flex-col items-center justify-center h-[280px] text-gray-400 gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-200 border-t-purple-500"></div>
                <p className="text-sm">決済フォームを読み込み中...</p>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handlePayment}
            disabled={!formReady || processing}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold rounded-xl hover:from-purple-700 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30"
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                処理中...
              </span>
            ) : (
              `¥${plan.price.toLocaleString()} を支払う`
            )}
          </button>

          <div className="flex items-center justify-center gap-2 mt-4">
            <svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-gray-400">
              SSL暗号化通信で安全に処理されます
            </p>
          </div>
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
