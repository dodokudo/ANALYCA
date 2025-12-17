'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AnalycaLogo from '@/components/AnalycaLogo';

// プラン定義
const PLANS = [
  {
    id: 'light-threads',
    name: 'Light',
    subtitle: 'Threads分析',
    price: 4980,
    features: [
      'Threadsアカウント分析',
      '投稿パフォーマンス追跡',
      'フォロワー推移グラフ',
      'エンゲージメント分析',
    ],
    onboardingPath: '/onboarding/light',
    popular: false,
  },
  {
    id: 'light-instagram',
    name: 'Light',
    subtitle: 'Instagram分析',
    price: 4980,
    features: [
      'Instagramアカウント分析',
      'リール・ストーリー分析',
      'フォロワー推移グラフ',
      'エンゲージメント分析',
    ],
    onboardingPath: '/onboarding/light2',
    popular: false,
  },
  {
    id: 'standard',
    name: 'Standard',
    subtitle: 'Instagram + Threads',
    price: 9800,
    features: [
      'Instagram + Threads両方',
      'クロスプラットフォーム分析',
      '全投稿タイプ対応',
      'フォロワー推移グラフ',
      'エンゲージメント分析',
    ],
    onboardingPath: '/onboarding/standard',
    popular: true,
  },
];

export default function PricingPage() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
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
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            あなたに最適なプランを選択
          </h2>
          <p className="text-gray-600 text-lg">
            SNS分析で成果を最大化しましょう
          </p>
        </div>

        {/* プランカード */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl shadow-lg border-2 transition-all hover:shadow-xl ${
                plan.popular
                  ? 'border-purple-500 scale-105'
                  : 'border-gray-200 hover:border-purple-300'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-purple-500 to-emerald-400 text-white text-sm font-medium px-4 py-1 rounded-full">
                    人気
                  </span>
                </div>
              )}

              <div className="p-6">
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                  <p className="text-sm text-gray-500">{plan.subtitle}</p>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">
                    ¥{plan.price.toLocaleString()}
                  </span>
                  <span className="text-gray-500">/月</span>
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
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={selectedPlan === plan.id}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                    plan.popular
                      ? 'bg-gradient-to-r from-purple-500 to-emerald-400 text-white hover:from-purple-600 hover:to-emerald-500'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  } disabled:opacity-50`}
                >
                  {selectedPlan === plan.id ? '選択中...' : 'このプランを選択'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 注意事項 */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>すべてのプランは月額課金です。いつでも解約できます。</p>
        </div>
      </main>
    </div>
  );
}
