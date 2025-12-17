'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Script from 'next/script';
import LoadingScreen from '@/components/LoadingScreen';

// プラン定義
const PLANS: Record<string, {
  name: string;
  subtitle: string;
  price: number;
  onboardingPath: string;
}> = {
  'light-threads': {
    name: 'Light',
    subtitle: 'Threads分析',
    price: 4980,
    onboardingPath: '/onboarding/light',
  },
  'light-instagram': {
    name: 'Light',
    subtitle: 'Instagram分析',
    price: 4980,
    onboardingPath: '/onboarding/light2',
  },
  'standard': {
    name: 'Standard',
    subtitle: 'Instagram + Threads',
    price: 9800,
    onboardingPath: '/onboarding/standard',
  },
};

function AnalycaLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };
  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };
  return (
    <div className={`${sizeClasses[size]} bg-gradient-to-r from-purple-500 to-emerald-400 rounded-lg flex items-center justify-center`}>
      <svg className={`${iconSizes[size]} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    </div>
  );
}

declare global {
  interface Window {
    UnivapayCheckout: {
      create: (config: Record<string, unknown>) => {
        open: () => void;
        close: () => void;
      };
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
    if (!scriptLoaded || !univaPayConfig) {
      setError('決済システムの準備ができていません');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const checkout = window.UnivapayCheckout.create({
        appId: univaPayConfig.appId,
        checkout: 'token',
        amount: plan.price,
        currency: 'JPY',
        cvvAuthorize: true,
        // インラインフォーム表示設定
        inline: true,
        inlineTarget: '#univapay-inline-form',
        // スタイル設定
        inlineItemStyle: 'padding: 12px 0; border-bottom: 1px solid #e5e7eb;',
        inlineItemLabelStyle: 'color: #374151; font-size: 14px; font-weight: 500;',
        inlineFieldStyle: 'border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; font-size: 16px;',
        // サブスクリプション設定
        subscriptionPeriod: 'monthly',
        // メタデータ
        metadata: {
          planId: planId,
          planName: plan.name,
        },
        // コールバック
        onSuccess: async (result: { id: string; type: string }) => {
          console.log('Payment success:', result);
          // 課金成功後、オンボーディングへリダイレクト
          // transaction_token_idをAPIに送信してサブスク作成
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
              router.push(plan.onboardingPath);
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
    } catch (err) {
      console.error('Checkout error:', err);
      setError('決済システムの初期化に失敗しました');
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-emerald-50">
      {/* UnivaPay Script */}
      <Script
        src="https://widget.univapay.com/client/checkout.js"
        onLoad={() => setScriptLoaded(true)}
      />

      {/* ヘッダー */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <AnalycaLogo size="md" />
          <h1 className="text-xl font-bold text-gray-800">ANALYCA</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-8">
          {/* 左側: 注文内容 */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-6">ご注文内容</h2>

            <div className="border border-gray-200 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-gray-800">{plan.name}プラン</h3>
                  <p className="text-sm text-gray-500">{plan.subtitle}</p>
                </div>
                <span className="text-lg font-bold text-gray-800">
                  ¥{plan.price.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-gray-400">月額・自動更新</p>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">合計（税込）</span>
                <span className="text-2xl font-bold text-gray-800">
                  ¥{plan.price.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                次回請求日: 1ヶ月後
              </p>
            </div>
          </div>

          {/* 右側: 決済フォーム */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-6">お支払い情報</h2>

            {/* UnivaPayインラインフォーム */}
            <div id="univapay-inline-form" className="mb-6 min-h-[200px]">
              {!scriptLoaded && (
                <div className="flex items-center justify-center h-48 text-gray-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handlePayment}
              disabled={!scriptLoaded || !univaPayConfig || processing}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-emerald-400 text-white font-bold rounded-xl hover:from-purple-600 hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  処理中...
                </span>
              ) : (
                `¥${plan.price.toLocaleString()} を支払う`
              )}
            </button>

            <p className="text-xs text-gray-400 text-center mt-4">
              お支払いはUnivaPayによって安全に処理されます
            </p>
          </div>
        </div>

        {/* 戻るリンク */}
        <div className="text-center mt-8">
          <button
            onClick={() => router.push('/pricing')}
            className="text-gray-500 hover:text-gray-700 text-sm"
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
