'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Script from 'next/script';

// 講座情報
const COURSE = {
  name: 'Threads×AI運用マスター講座',
  price: 110000,
  description: 'AIを活用したThreads運用の完全マスターコース',
};

const SUCCESS_REDIRECT_URLS = {
  full: 'https://liff.line.me/2007350099-K9dE2l1E/landing?follow=%40118dgavc&lp=Oi3OMx&liff_id=2007350099-K9dE2l1E',
  installment: 'https://liff.line.me/2007350099-K9dE2l1E/landing?follow=%40118dgavc&lp=SI1zjn&liff_id=2007350099-K9dE2l1E',
};

function CourseCheckoutContent() {
  const searchParams = useSearchParams();
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [univaPayConfig, setUnivaPayConfig] = useState<{ appId: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const paymentType = searchParams.get('payment') === 'installment' ? 'installment' : 'full';
  const isInstallment = paymentType === 'installment';
  const successRedirectUrl = SUCCESS_REDIRECT_URLS[paymentType];

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const iframe = document.querySelector('#univapay-course-checkout iframe');
    if (!iframe || !window.UnivapayCheckout) {
      setError('決済フォームの準備ができていません。ページを再読み込みしてください。');
      return;
    }

    setProcessing(true);
    try {
      await window.UnivapayCheckout.submit(iframe);
      window.location.href = successRedirectUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : '決済処理に失敗しました。入力内容を確認してください。';
      setError(message);
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      <Script
        src="https://widget.univapay.com/client/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />

      <main className="max-w-lg mx-auto px-4 py-8 md:py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-purple-600 mb-1">
                {isInstallment ? 'クレジットカード分割決済' : 'クレジットカード一括決済'}
              </p>
              <h2 className="font-bold text-gray-800 text-lg">{COURSE.name}</h2>
            </div>
            <div className="text-right shrink-0">
              <span className="text-2xl font-bold text-gray-800">
                ¥{COURSE.price.toLocaleString()}
              </span>
              <p className="text-xs text-gray-400">税込</p>
            </div>
          </div>

          {isInstallment && (
            <div className="border-t border-gray-100 pt-4 mt-4">
              <p className="text-sm text-gray-600">
                分割決済に対応していないカードの場合は、分割決済を行うことができません。
                <a href="/checkout/course?payment=full" className="font-semibold text-purple-600 underline underline-offset-2">
                  一括決済はこちら
                </a>
              </p>
            </div>
          )}
        </div>

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

          <div id="univapay-course-checkout" className="min-h-[420px] relative">
            {isReady ? (
              <span
                key={paymentType}
                data-app-id={univaPayConfig.appId}
                data-checkout="payment"
                data-amount={COURSE.price}
                data-currency="jpy"
                data-inline="true"
                data-allow-card-installments={isInstallment ? 'true' : 'false'}
                data-card-installment-options={isInstallment ? '3,6,12,24' : undefined}
                data-require-phone-number="false"
                data-phone-number="00000000000"
                data-success-redirect-url={successRedirectUrl}
                data-metadata={JSON.stringify({
                  courseName: COURSE.name,
                  paymentType,
                })}
                data-inline-item-style="padding: 10px 0; border-bottom: none;"
                data-inline-item-label-style="color: #4b5563; font-size: 13px; font-weight: 600; margin-bottom: 6px;"
                data-inline-text-field-style="border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; font-size: 15px; background: #fafafa; width: 100%; box-sizing: border-box;"
                data-inline-field-focus-style="border-color: #8b5cf6; background: #fff; box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);"
                data-inline-field-invalid-style="border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);"
                className="univapay-payment-checkout block"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-gray-500" />
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
              disabled={!isReady || processing}
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-400 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 text-lg"
            >
              {processing ? '処理中...' : 'いますぐ購入する'}
            </button>

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
      </main>
    </div>
  );
}

export default function CourseCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-gray-500"></div>
      </div>
    }>
      <CourseCheckoutContent />
    </Suspense>
  );
}
