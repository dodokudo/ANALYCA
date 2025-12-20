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

// 分割払いオプション
const INSTALLMENT_OPTIONS = [
  { value: 1, label: '一括払い', monthly: COURSE.price },
  { value: 3, label: '3回払い', monthly: Math.ceil(COURSE.price / 3) },
  { value: 6, label: '6回払い', monthly: Math.ceil(COURSE.price / 6) },
  { value: 12, label: '12回払い', monthly: Math.ceil(COURSE.price / 12) },
  { value: 24, label: '24回払い', monthly: Math.ceil(COURSE.price / 24) },
];

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
  const [selectedInstallment, setSelectedInstallment] = useState(1);

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
      const checkoutConfig: Record<string, unknown> = {
        appId: univaPayConfig.appId,
        checkout: 'payment',
        amount: COURSE.price,
        currency: 'JPY',
        cvvAuthorize: true,
        // メタデータ
        metadata: {
          courseName: COURSE.name,
          installments: selectedInstallment,
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
      };

      // 分割払いの場合はinstallment設定を追加
      if (selectedInstallment > 1) {
        checkoutConfig.tokenType = 'subscription';
        checkoutConfig.subscriptionPlan = {
          planType: 'installment',
          fixedCycles: selectedInstallment,
          fixedCycleAmount: Math.ceil(COURSE.price / selectedInstallment),
        };
      }

      const checkout = window.UnivapayCheckout.create(checkoutConfig);
      checkout.open();
    } catch (err) {
      console.error('Checkout error:', err);
      setError('決済システムの初期化に失敗しました');
      setProcessing(false);
    }
  };

  const selectedOption = INSTALLMENT_OPTIONS.find(opt => opt.value === selectedInstallment);

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
        <div className="grid md:grid-cols-2 gap-8">
          {/* 左側: 講座情報 */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <h2 className="text-lg font-bold text-white mb-6">講座内容</h2>

            <div className="mb-6">
              <h3 className="text-2xl font-bold text-white mb-2">{COURSE.name}</h3>
              <p className="text-gray-300">{COURSE.description}</p>
            </div>

            <div className="border-t border-white/20 pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-300">講座価格</span>
                <span className="text-2xl font-bold text-white">
                  ¥{COURSE.price.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-gray-400">税込</p>
            </div>
          </div>

          {/* 右側: 支払い方法選択 */}
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-6">お支払い方法</h2>

            {/* 分割払い選択 */}
            <div className="space-y-3 mb-6">
              {INSTALLMENT_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedInstallment === option.value
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="installment"
                      value={option.value}
                      checked={selectedInstallment === option.value}
                      onChange={() => setSelectedInstallment(option.value)}
                      className="w-5 h-5 text-purple-600"
                    />
                    <span className="font-medium text-gray-800">{option.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-gray-800">
                      ¥{option.monthly.toLocaleString()}
                    </span>
                    {option.value > 1 && (
                      <span className="text-sm text-gray-500">/月</span>
                    )}
                  </div>
                </label>
              ))}
            </div>

            {/* 選択内容サマリー */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">お支払い合計</span>
                <span className="text-xl font-bold text-gray-800">
                  ¥{COURSE.price.toLocaleString()}
                </span>
              </div>
              {selectedInstallment > 1 && (
                <p className="text-sm text-gray-500 mt-1">
                  ({selectedInstallment}回 × ¥{selectedOption?.monthly.toLocaleString()})
                </p>
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
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold rounded-xl hover:from-purple-700 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
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
