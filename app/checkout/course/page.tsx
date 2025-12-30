'use client';

import { useState, useEffect, Suspense } from 'react';
import Script from 'next/script';

// 講座情報
const COURSE = {
  name: 'Threads×AI運用マスター講座',
  price: 110000,
  description: 'AIを活用したThreads運用の完全マスターコース',
};

function CourseCheckoutContent() {
  const [scriptLoaded, setScriptLoaded] = useState(false);
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
      });
  }, []);

  const isReady = scriptLoaded && univaPayConfig;

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

            {/* UnivaPay HTMLタグ方式 - 分割払い対応 */}
            <div className="flex justify-center">
              {isReady ? (
                <span
                  data-app-id={univaPayConfig.appId}
                  data-checkout="payment"
                  data-amount={COURSE.price}
                  data-currency="jpy"
                  data-allow-card-installments="true"
                  data-card-installment-options="1,3,6,12,24"
                  data-success-redirect-url="https://analyca.vercel.app/checkout/course/complete"
                  data-metadata={JSON.stringify({ courseName: COURSE.name })}
                  className="univapay-payment-checkout w-full py-4 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-lg rounded-xl hover:from-purple-700 hover:to-pink-600 transition-all cursor-pointer shadow-lg text-center block"
                >
                  お支払いへ進む
                </span>
              ) : (
                <div className="w-full py-4 bg-gray-300 text-gray-500 font-bold text-lg rounded-xl text-center">
                  読み込み中...
                </div>
              )}
            </div>

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
