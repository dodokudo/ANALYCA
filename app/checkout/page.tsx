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
  const observerRef = useRef<MutationObserver | null>(null);

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

  // iframeをbodyからコンテナ内に移動するObserver
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (
            node instanceof HTMLIFrameElement &&
            node.style.position === 'fixed' &&
            node.style.zIndex === '2147483647'
          ) {
            const container = document.getElementById('univapay-card-form');
            if (container) {
              node.style.position = 'relative';
              node.style.inset = 'unset';
              node.style.width = '100%';
              node.style.height = '520px';
              node.style.zIndex = '1';
              node.style.maxHeight = 'none';
              node.style.display = 'block';
              node.style.overflow = 'hidden';
              node.style.background = 'transparent';
              container.appendChild(node);
              setFormReady(true);
              observer.disconnect();
            }
            break;
          }
        }
      }
    });

    observer.observe(document.body, { childList: true });
    observerRef.current = observer;

    return () => observer.disconnect();
  }, []);

  // チェックアウト初期化（inlineモードでカードフォームを生成）
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
        inlineTarget: '#univapay-card-form',
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
        },
        onCancel: () => {
          setProcessing(false);
        },
      });

      checkout.open();
      checkoutRef.current = checkout;
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
    if (!formReady) return;
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
              <p className="text-xs text-gray-400">税込 / 月</p>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-3 mt-3 text-xs text-gray-400">
            月額・自動更新 ・ 次回請求日: 1ヶ月後
          </div>
        </div>

        {/* カード入力フォーム */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">カード情報</h2>
            <div className="flex items-center gap-1.5">
              {/* Visa */}
              <svg className="h-7 w-auto" viewBox="0 0 48 32" fill="none">
                <rect width="48" height="32" rx="4" fill="#1A1F71"/>
                <path d="M19.5 21h-2.7l1.7-10.5h2.7L19.5 21zm11.1-10.2c-.5-.2-1.4-.4-2.4-.4-2.7 0-4.5 1.4-4.5 3.4 0 1.5 1.4 2.3 2.4 2.8 1 .5 1.4.8 1.4 1.3 0 .7-.8 1-1.6 1-.9 0-1.8-.2-2.5-.5l-.4-.2-.4 2.3c.7.3 1.9.5 3.2.5 2.8 0 4.7-1.4 4.7-3.5 0-1.2-.7-2.1-2.3-2.8-.9-.5-1.5-.8-1.5-1.3 0-.4.5-.9 1.5-.9.9 0 1.5.2 2 .4l.2.1.4-2.2zM35 10.5h-2.1c-.6 0-1.1.2-1.4.8L27.8 21h2.8l.6-1.5h3.4l.3 1.5H37L35 10.5zm-3 7.5l1.1-2.9.3-.9.2.9.6 2.9h-2.2zM16.3 10.5L13.6 18l-.3-1.4c-.5-1.6-2-3.4-3.8-4.2l2.4 8.6h2.9l4.3-10.5h-2.8z" fill="white"/>
                <path d="M11.7 10.5H7.5l-.1.2c3.4.8 5.6 2.9 6.5 5.3l-.9-4.7c-.2-.6-.7-.8-1.3-.8z" fill="#F9A533"/>
              </svg>
              {/* Mastercard */}
              <svg className="h-7 w-auto" viewBox="0 0 48 32" fill="none">
                <rect width="48" height="32" rx="4" fill="#252525"/>
                <circle cx="19" cy="16" r="8" fill="#EB001B"/>
                <circle cx="29" cy="16" r="8" fill="#F79E1B"/>
                <path d="M24 9.8A8 8 0 0 1 27 16a8 8 0 0 1-3 6.2A8 8 0 0 1 21 16a8 8 0 0 1 3-6.2z" fill="#FF5F00"/>
              </svg>
              {/* JCB */}
              <div className="h-7 px-1.5 bg-gradient-to-b from-blue-600 to-blue-800 rounded text-white text-[9px] font-bold flex items-center">JCB</div>
              {/* AMEX */}
              <div className="h-7 px-1.5 bg-blue-500 rounded text-white text-[8px] font-bold flex items-center">AMEX</div>
            </div>
          </div>

          {/* UnivaPayカードフォーム埋め込み領域 */}
          <div id="univapay-card-form" className="min-h-[400px] relative">
            {!formReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-200 border-t-purple-500"></div>
                <p className="text-sm">カード入力フォームを読み込み中...</p>
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
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold rounded-xl hover:from-purple-700 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
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
