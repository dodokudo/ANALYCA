'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AnalycaLogo from '@/components/AnalycaLogo';
import * as gtag from '@/lib/gtag';

// プラン定義
const PLANS = [
  {
    id: 'light-threads',
    yearlyId: 'light-threads-yearly',
    name: 'Light',
    subtitle: 'Threads分析',
    monthlyPrice: 4980,
    yearlyMonthlyPrice: 3980,
    yearlyTotal: 47760,
    features: [
      'Threads分析',
      '投稿パフォーマンス追跡',
      'フォロワー推移グラフ',
      'エンゲージメント分析',
      '予約投稿 30件/月',
    ],
    popular: false,
  },
  {
    id: 'standard',
    yearlyId: 'standard-yearly',
    name: 'Standard',
    subtitle: 'Instagram + Threads',
    monthlyPrice: 9800,
    yearlyMonthlyPrice: 7840,
    yearlyTotal: 94080,
    features: [
      'Instagram + Threads両方',
      'クロスプラットフォーム分析',
      '全投稿タイプ対応',
      'フォロワー推移グラフ',
      'エンゲージメント分析',
      '予約投稿 100件/月',
    ],
    popular: true,
  },
  {
    id: 'pro',
    yearlyId: 'pro-yearly',
    name: 'Pro',
    subtitle: '全機能 + 予約投稿無制限',
    monthlyPrice: 19000,
    yearlyMonthlyPrice: 15200,
    yearlyTotal: 182400,
    features: [
      'Standard全機能',
      '予約投稿 無制限',
      '優先サポート',
    ],
    popular: false,
  },
];

export default function PricingPage() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isYearly, setIsYearly] = useState(false);

  const handleSelectPlan = (plan: typeof PLANS[number]) => {
    const planId = isYearly ? plan.yearlyId : plan.id;
    const price = isYearly ? plan.yearlyTotal : plan.monthlyPrice;
    setSelectedPlan(planId);
    gtag.event('begin_checkout', {
      value: price,
      currency: 'JPY',
      plan_id: planId,
    });
    router.push(`/checkout?plan=${planId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-emerald-50">
      {/* ヘッダー */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <AnalycaLogo size="md" showText />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-16">
        {/* タイトル */}
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            あなたに最適なプランを選択
          </h2>
          <p className="text-gray-600 text-lg">
            SNS分析で成果を最大化しましょう
          </p>
        </div>

        {/* 年払い/月払いセグメントコントロール */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                !isYearly
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              月払い
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                isYearly
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              年払い
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                20%OFF
              </span>
            </button>
          </div>
        </div>

        {/* プランカード */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map((plan) => {
            const displayPrice = isYearly ? plan.yearlyMonthlyPrice : plan.monthlyPrice;
            const currentPlanId = isYearly ? plan.yearlyId : plan.id;

            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl shadow-lg border-2 transition-all hover:shadow-xl ${
                  plan.popular
                    ? 'border-purple-500 scale-105'
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                {/* バッジ */}
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  {plan.popular ? (
                    <span className="bg-gradient-to-r from-purple-500 to-emerald-400 text-white text-sm font-semibold px-5 py-1.5 rounded-full shadow-md whitespace-nowrap">
                      人気 - 7日間無料
                    </span>
                  ) : (
                    <span className="bg-emerald-500 text-white text-sm font-medium px-4 py-1 rounded-full whitespace-nowrap">
                      7日間無料
                    </span>
                  )}
                </div>

                <div className="p-6 pt-8">
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                    <p className="text-sm text-gray-500">{plan.subtitle}</p>
                  </div>

                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900">
                      ¥{displayPrice.toLocaleString()}
                    </span>
                    <span className="text-gray-500">/月</span>
                    {isYearly && (
                      <p className="text-xs text-gray-400 mt-1">
                        年額 ¥{plan.yearlyTotal.toLocaleString()}
                      </p>
                    )}
                  </div>

                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <svg
                          className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span className="text-gray-600 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSelectPlan(plan)}
                    disabled={selectedPlan === currentPlanId}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                      plan.popular
                        ? 'bg-gradient-to-r from-purple-500 to-purple-700 text-white hover:from-purple-600 hover:to-purple-800'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    } disabled:opacity-50`}
                  >
                    {selectedPlan === currentPlanId ? '選択中...' : '無料で試す'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 注意事項 */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>すべてのプランに7日間の無料体験がつきます。期間中はいつでもキャンセル可能。8日目から課金が開始されます。</p>
        </div>
      </main>
    </div>
  );
}
