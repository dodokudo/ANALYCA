'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';

// 講座情報
const COURSE = {
  name: 'Threads×AI運用マスター講座',
  price: 110000,
  description: 'AIを活用したThreads運用の完全マスターコース',
};

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

function CourseCheckoutContent() {
  const router = useRouter();
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
        checkout: 'payment',
        amount: COURSE.price,
        currency: 'JPY',
        // 分割払い設定（UnivaPayのカード分割払い機能）
        allowCardInstallments: true,
        cardInstallmentOptions: [1, 3, 6, 12, 24],
        // メタデータ
        metadata: {
          courseName: COURSE.name,
        },
        // コールバック
        onSuccess: async (result: { id: string; type: string }) => {
          console.log('Payment success:', result);
          // 決済成功 → 完了ページへリダイレクト
          router.push('/checkout/course/complete');
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* UnivaPay Script */}
      <Script
        src="https://widget.univapay.com/client/checkout.js"
        onLoad={() => setScriptLoaded(true)}
      />

      {/* ヘッダー */}
      <header className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-xl font-bold text-white">お申し込み</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="max-w-xl mx-auto">
          {/* 講座情報カード */}
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">{COURSE.name}</h2>
              <p className="text-gray-500">{COURSE.description}</p>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 mb-8">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">講座価格（税込）</p>
                <p className="text-4xl font-bold text-gray-800">
                  ¥{COURSE.price.toLocaleString()}
                </p>
                <p className="text-sm text-purple-600 mt-2">
                  ※ 分割払い（3回・6回・12回・24回）対応
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handlePayment}
              disabled={!scriptLoaded || !univaPayConfig || processing}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-lg rounded-xl hover:from-purple-700 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  処理中...
                </span>
              ) : (
                'お支払いへ進む'
              )}
            </button>

            <p className="text-xs text-gray-400 text-center mt-4">
              お支払いはUnivaPayによって安全に処理されます
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CourseCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    }>
      <CourseCheckoutContent />
    </Suspense>
  );
}
