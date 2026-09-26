'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AnalycaLogo from '@/components/AnalycaLogo';
import { safeLocalStorage } from '@/lib/safe-storage';

// ============ アイコンコンポーネント ============
function InstagramIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

function ThreadsIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z"/>
    </svg>
  );
}

function CheckIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ChevronDownIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// 作った人の実績欄。掲載する数字と顔写真が確定するまで非表示
const SHOW_MAKER_SECTION = false;

// ============ 機能一覧のアイコン（線のアイコン） ============
const FEATURE_ICON_PATHS: Record<string, string> = {
  ranking: 'M8 21h8m-4-4v4m-5-9V4h10v8a5 5 0 01-10 0zM7 6H4v2a3 3 0 003 3m10-5h3v2a3 3 0 01-3 3',
  followers: 'M3 17l6-6 4 4 8-8m0 0v6m0-6h-6',
  transition: 'M8 10h8M8 14h5m-9 6l2.5-3H19a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v11.5',
  engagement: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  schedule: 'M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1zm7 9v3l2 1',
  instagram: 'M4 8a4 4 0 014-4h8a4 4 0 014 4v8a4 4 0 01-4 4H8a4 4 0 01-4-4V8zm12 4a4 4 0 11-8 0 4 4 0 018 0zm1.5-5.5h.01',
};

function FeatureIcon({ name }: { name: string }) {
  return (
    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={FEATURE_ICON_PATHS[name]} />
    </svg>
  );
}

// ============ モックアップコンポーネント ============
function DashboardMockup() {
  return (
    <div className="relative w-full max-w-xl mx-auto">
      {/* PCモックアップ（メイン） */}
      <div className="relative z-10">
        <img
          src="/demo/mockup-pc.png"
          alt="ANALYCA ダッシュボード - PC表示"
          className="w-full drop-shadow-2xl"
          style={{ background: 'transparent' }}
        />
      </div>

      {/* スマホモックアップ（右下に重ねる） */}
      <div className="absolute -right-4 -bottom-4 w-[35%] z-20 md:-right-8 md:-bottom-8">
        <img
          src="/demo/mockup-mobile.png"
          alt="ANALYCA ダッシュボード - スマホ表示"
          className="w-full drop-shadow-2xl"
          style={{ background: 'transparent' }}
        />
      </div>
    </div>
  );
}

// ============ FAQアイテム ============
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-gray-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-5 flex items-center justify-between text-left"
      >
        <span className="font-medium text-gray-900">{question}</span>
        <ChevronDownIcon className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="pb-5 text-gray-600 text-sm leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}

// ============ 料金プランセクション ============
const PRICING_PLANS = [
  {
    id: 'light-threads',
    yearlyId: 'light-threads-yearly',
    name: 'Light',
    subtitle: 'Threads分析',
    monthlyPrice: 4980,
    yearlyMonthlyPrice: 3980,
    yearlyTotal: 47760,
    features: ['Threads分析', '投稿パフォーマンス追跡', 'フォロワー推移グラフ', 'エンゲージメント分析', '予約投稿 30件/月'],
    popular: true,
  },
  {
    id: 'standard',
    yearlyId: 'standard-yearly',
    name: 'Standard',
    subtitle: 'Instagram + Threads',
    monthlyPrice: 9800,
    yearlyMonthlyPrice: 7840,
    yearlyTotal: 94080,
    features: ['Instagram + Threads両方', 'クロスプラットフォーム分析', '全投稿タイプ対応', 'フォロワー推移グラフ', 'エンゲージメント分析', '予約投稿 100件/月'],
    popular: false,
  },
  {
    id: 'pro',
    yearlyId: 'pro-yearly',
    name: 'Pro',
    subtitle: '全機能 + 予約投稿無制限',
    monthlyPrice: 19000,
    yearlyMonthlyPrice: 15200,
    yearlyTotal: 182400,
    features: ['Standard全機能', '予約投稿 無制限', '優先サポート'],
    popular: false,
  },
];

function PricingSection() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section id="pricing" className="py-16 md:py-24 bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            料金プラン
          </h2>
          <p className="text-gray-600 text-lg">
            7日間は無料。合わなければ期間中に解約できます
          </p>
        </div>

        {/* 月払い/年払いトグル */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                !isYearly ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              月払い
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                isYearly ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              年払い
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                20%OFF
              </span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PRICING_PLANS.map((plan) => {
            const displayPrice = isYearly ? plan.yearlyMonthlyPrice : plan.monthlyPrice;
            const planId = isYearly ? plan.yearlyId : plan.id;

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl border-2 p-6 relative transition-all hover:shadow-xl ${
                  plan.popular ? 'border-purple-500 shadow-lg scale-105' : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  {plan.popular ? (
                    <span className="bg-gradient-to-r from-purple-500 to-emerald-400 text-white text-sm font-semibold px-5 py-1.5 rounded-full shadow-md whitespace-nowrap">
                      おすすめ - 7日間無料
                    </span>
                  ) : (
                    <span className="bg-emerald-500 text-white text-sm font-medium px-4 py-1 rounded-full whitespace-nowrap">
                      7日間無料
                    </span>
                  )}
                </div>
                <div className="mb-4 pt-2">
                  <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                  <p className="text-sm text-gray-500">{plan.subtitle}</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">¥{displayPrice.toLocaleString()}</span>
                  <span className="text-gray-500">/月</span>
                  {isYearly && (
                    <p className="text-xs text-gray-400 mt-1">年額 ¥{plan.yearlyTotal.toLocaleString()}</p>
                  )}
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckIcon className="w-5 h-5 text-emerald-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/checkout?plan=${planId}`}
                  className={`block w-full text-center font-medium py-3 rounded-lg transition-all ${
                    plan.popular
                      ? 'bg-gradient-to-r from-purple-500 to-emerald-400 text-white hover:from-purple-600 hover:to-emerald-500'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  無料で試す
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-8 mx-auto flex max-w-5xl flex-col gap-4 rounded-2xl border border-pink-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-bold text-gray-900"><InstagramIcon className="w-4 h-4 text-pink-500" />Instagramだけ使いたい方</p>
            <p className="mt-1 text-sm text-gray-600">Instagram分析 Lightプラン（月額4,980円・税込）</p>
          </div>
          <Link
            href="/checkout?plan=light-instagram"
            className="shrink-0 rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 px-6 py-3 text-center font-semibold text-white transition-all hover:from-pink-600 hover:to-purple-700"
          >
            Instagram分析を始める
          </Link>
        </div>

        <p className="text-center text-sm text-gray-500 mt-8">
          すべてのプランに7日間の無料体験がつきます。期間中はいつでもキャンセル可能。8日目から課金が開始されます。
        </p>
      </div>
    </section>
  );
}

// ============ メインコンポーネント ============
export default function HomePage() {
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);

  useEffect(() => {
    let userId = safeLocalStorage.getItem('analycaUserId');
    if (!userId) {
      const match = document.cookie.match(/(?:^|;\s*)analycaUserId=([^;]+)/);
      if (match) {
        userId = decodeURIComponent(match[1]);
        safeLocalStorage.setItem('analycaUserId', userId);
      }
    }
    if (userId) {
      setLoggedInUserId(userId);
    }

    // 紹介コード（refパラメータ）をlocalStorageに保存
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      safeLocalStorage.setItem('analyca_ref', ref);
      // アフィリエイトクリックを記録
      fetch('/api/affiliate/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affiliate_code: ref,
          referrer: document.referrer || '',
          utm_source: params.get('utm_source') || '',
          utm_medium: params.get('utm_medium') || '',
          utm_campaign: params.get('utm_campaign') || '',
          user_agent: navigator.userAgent,
        }),
      }).catch(() => { /* non-blocking */ });
    }

    // UTMパラメータをlocalStorageに保存
    const utmSource = params.get('utm_source');
    const utmMedium = params.get('utm_medium');
    const utmCampaign = params.get('utm_campaign');
    const utmContent = params.get('utm_content');
    if (utmSource) safeLocalStorage.setItem('analyca_utm_source', utmSource);
    if (utmMedium) safeLocalStorage.setItem('analyca_utm_medium', utmMedium);
    if (utmCampaign) safeLocalStorage.setItem('analyca_utm_campaign', utmCampaign);
    if (utmContent) safeLocalStorage.setItem('analyca_utm_content', utmContent);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* ============ ヘッダー ============ */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AnalycaLogo size="sm" />
            <span className="text-lg font-bold text-gray-900">ANALYCA</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">機能</a>
            <a href="#reasons" className="text-gray-600 hover:text-gray-900 transition-colors">選ばれる理由</a>
            <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">料金プラン</a>
            <a href="#faq" className="text-gray-600 hover:text-gray-900 transition-colors">よくある質問</a>
            <Link href="/media" className="text-gray-600 hover:text-gray-900 transition-colors">Threads運用メディア</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/media" className="md:hidden text-sm text-gray-600 hover:text-gray-900 transition-colors">
              メディア
            </Link>
            <Link href="/demo" className="hidden md:block text-sm text-gray-600 hover:text-gray-900 transition-colors">
              デモを見る
            </Link>
            {loggedInUserId ? (
              <Link
                href={`/${loggedInUserId}`}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                ダッシュボード
              </Link>
            ) : null}
            <a
              href="#pricing"
              className="bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-600 hover:to-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all"
            >
              7日間無料で試す
            </a>
          </div>
        </div>
      </header>

      {/* ============ ヒーローセクション ============ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-emerald-50 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* 左側：テキスト */}
            <div>
              <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 text-sm font-medium px-3 py-1 rounded-full mb-6">
                <ThreadsIcon className="w-4 h-4" />
                <span>Threads専用の分析ツール</span>
              </div>
              <h1 className="text-[2rem] md:text-[2.35rem] font-bold text-gray-900 leading-snug mb-6">
                <span className="whitespace-nowrap">Threadsの</span>
                <span className="whitespace-nowrap"><span className="bg-gradient-to-r from-purple-500 to-emerald-400 bg-clip-text text-transparent">「なぜ伸びた？」</span>を、</span>
                <br />
                <span className="whitespace-nowrap">数字で答えられる</span>
                <span className="whitespace-nowrap">ようにする。</span>
              </h1>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                投稿ごとの閲覧数・いいね・コメント欄からの遷移を自動で集計。
                伸びた投稿と伸びなかった投稿を、ダッシュボードで並べて比べられます。
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="#pricing"
                  className="inline-flex items-center justify-center bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-600 hover:to-emerald-500 text-white font-semibold px-8 py-4 rounded-xl transition-all shadow-lg shadow-purple-500/25"
                >
                  7日間無料で試す
                </a>
                <Link
                  href="/demo"
                  className="inline-flex items-center justify-center border-2 border-gray-200 text-gray-700 font-semibold px-8 py-4 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  デモダッシュボードを見る
                </Link>
              </div>
              <p className="mt-4 text-sm text-gray-500">
                無料期間中はいつでも解約できます。8日目から課金が始まります。
              </p>
            </div>

            {/* 右側：モックアップ */}
            <div className="relative">
              <DashboardMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ============ サービス概要（3つの利点） ============ */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Threads運用、こんな状態になっていませんか
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              どの投稿が伸びたのか説明できない。数字を集めるのが面倒。コメント欄からの誘導が効いているかわからない。ANALYCAはこの3つを解決します
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* 時間削減 */}
            <div className="bg-gradient-to-br from-purple-50 to-white p-8 rounded-2xl border border-purple-100">
              <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">手作業の集計が不要に</h3>
              <p className="text-gray-600">
                スクリーンショットや手入力での数字集めは不要。ログインするだけで、投稿の数字を自動で取得します。
              </p>
            </div>

            {/* データの蓄積 */}
            <div className="bg-gradient-to-br from-emerald-50 to-white p-8 rounded-2xl border border-emerald-100">
              <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">過去の投稿データも残る</h3>
              <p className="text-gray-600">
                取得したデータはANALYCAに蓄積され、消えません。先月・半年前の投稿とも、いつでも比べられます。
              </p>
            </div>

            {/* わかりやすい */}
            <div className="bg-gradient-to-br from-blue-50 to-white p-8 rounded-2xl border border-blue-100">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">伸びた投稿がひと目でわかる</h3>
              <p className="text-gray-600">
                閲覧数・いいね順のランキングと、コメント欄からの遷移率で、どの投稿が効いたかを確認できます。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 作った人の実績 ============ */}
      {SHOW_MAKER_SECTION && (
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-emerald-50 p-8 md:p-10 grid md:grid-cols-[auto_1fr] gap-8 items-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-200 to-emerald-200 flex items-center justify-center text-xs text-gray-500 text-center">
              顔写真
            </div>
            <div>
              <p className="text-sm font-semibold text-purple-700 mb-2">ANALYCAを作った人</p>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                Threadsで伸ばしてきた運用者が、自分のために作った分析ツールです
              </h2>
              <div className="grid sm:grid-cols-3 gap-3">
                {['Threadsの実績（確認後に掲載）', 'フォロワー数など（確認後に掲載）', '運用歴など（確認後に掲載）'].map((label) => (
                  <div key={label} className="rounded-xl border border-dashed border-purple-200 bg-white/70 px-4 py-3 text-sm text-gray-500">
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ============ 機能紹介 ============ */}
      <section id="features" className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              主な機能
            </h2>
            <p className="text-gray-600 text-lg">
              Threads運用に必要な数字を、ひとつのダッシュボードに
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: 'ranking', title: '投稿ランキング', desc: '閲覧数・いいね数で投稿をランキング表示。伸びた投稿がすぐわかる' },
              { icon: 'followers', title: 'フォロワー推移グラフ', desc: '日別のフォロワー増減を可視化。どの日の投稿で増えたかを把握' },
              { icon: 'transition', title: 'コメント欄の遷移率', desc: 'コメント欄からの遷移など、Threads独自の指標を分析' },
              { icon: 'engagement', title: 'エンゲージメント分析', desc: 'いいね・コメント・リポストからエンゲージメント率を算出' },
              { icon: 'schedule', title: '予約投稿', desc: '投稿を日時指定で予約。Lightプランは月30件まで' },
              { icon: 'instagram', title: 'Instagramも分析（Standard）', desc: 'リール・ストーリーを含むInstagramの分析も、同じ画面で追加できます' },
            ].map((feature, i) => (
              <div key={i} className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center mb-4">
                  <FeatureIcon name={feature.icon} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ デモ動画 ============ */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              実際の操作をチェック
            </h2>
            <p className="text-gray-600 text-lg">
              PC・スマホどちらからでも快適に分析できます
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-8 items-end max-w-5xl mx-auto">
            {/* PC版デモ - MacBookフレーム */}
            <div>
              <p className="text-sm font-semibold text-gray-500 mb-4 text-center">PC版</p>
              <div className="relative">
                <div className="bg-[#2d2d2d] rounded-t-xl pt-3 px-3">
                  <div className="flex justify-center mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                  </div>
                  <div className="bg-black rounded-t-sm overflow-hidden">
                    <video
                      src="/demo/demo-pc.mp4"
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="w-full block"
                    />
                  </div>
                </div>
                <div className="bg-gradient-to-b from-[#c0c0c0] to-[#a8a8a8] h-3 rounded-b-lg" style={{ width: '102%', marginLeft: '-1%' }}>
                  <div className="bg-[#b0b0b0] h-0.5 rounded-full mx-auto" style={{ width: '18%', marginTop: '5px' }} />
                </div>
              </div>
            </div>

            {/* スマホ版デモ */}
            <div>
              <p className="text-sm font-semibold text-gray-500 mb-4 text-center">スマホ版</p>
              <video
                src="/demo/demo-phone.mp4"
                autoPlay
                muted
                loop
                playsInline
                className="w-full rounded-2xl drop-shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============ 選ばれる5つの理由 ============ */}
      <section id="reasons" className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              ANALYCAが選ばれる5つの理由
            </h2>
          </div>

          <div className="space-y-6">
            <div className="flex gap-6 items-start p-6 rounded-2xl bg-purple-50 border border-purple-100">
              <div className="text-4xl font-bold text-purple-300">01</div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Meta公式APIを使用</h3>
                <p className="text-gray-600">Threads API（InstagramはInstagram Graph API）を正式に利用。安全かつ正確なデータを取得します。</p>
              </div>
            </div>
            <div className="flex gap-6 items-start p-6 rounded-2xl bg-emerald-50 border border-emerald-100">
              <div className="text-4xl font-bold text-emerald-300">02</div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">設定かんたん、すぐ使える</h3>
                <p className="text-gray-600">Threadsのアカウントでログインするだけ。複雑な初期設定は不要です。</p>
              </div>
            </div>
            <div className="flex gap-6 items-start p-6 rounded-2xl bg-blue-50 border border-blue-100">
              <div className="text-4xl font-bold text-blue-300">03</div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">データは無期限で保存</h3>
                <p className="text-gray-600">BigQueryでデータを安全に蓄積。過去のデータも消えずにいつでも参照できます。</p>
              </div>
            </div>
            <div className="flex gap-6 items-start p-6 rounded-2xl bg-amber-50 border border-amber-100">
              <div className="text-4xl font-bold text-amber-300">04</div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">シンプルで見やすいUI</h3>
                <p className="text-gray-600">必要な情報だけを厳選。スマホでもPCでも快適に閲覧できるレスポンシブデザイン。</p>
              </div>
            </div>
            <div className="flex gap-6 items-start p-6 rounded-2xl bg-rose-50 border border-rose-100">
              <div className="text-4xl font-bold text-rose-300">05</div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">コストパフォーマンス</h3>
                <p className="text-gray-600">月額4,980円から。高機能な分析ツールを手頃な価格で提供します。</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 始める3ステップ ============ */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-purple-50 via-white to-emerald-50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              かんたん3ステップで始められる
            </h2>
            <p className="text-gray-600 text-lg">
              難しい操作は一切ありません
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-purple-600">1</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">プランを選んで申し込み</h3>
              <p className="text-gray-600 text-sm">7日間無料。クレジットカードを登録するだけ。期間中はいつでもキャンセル可能です。</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-emerald-600">2</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Threadsでログイン</h3>
              <p className="text-gray-600 text-sm">Threadsのアカウントで認証するだけ。面倒な設定は不要です。</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">3</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">すぐにダッシュボードを確認</h3>
              <p className="text-gray-600 text-sm">ログインした瞬間からデータを取得開始。投稿分析・フォロワー推移がすぐに見られます。</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 料金プラン ============ */}
      <PricingSection />

      {/* ============ よくある質問 ============ */}
      <section id="faq" className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              よくある質問
            </h2>
          </div>

          <div className="divide-y divide-gray-200">
            <FAQItem
              question="ANALYCAとはどのようなサービスですか？"
              answer="ANALYCAは、Threadsのインサイトデータを自動で取得・分析するThreads専用の分析ツールです。投稿のパフォーマンス、フォロワー推移、コメント欄からの遷移率などを可視化します。Standardプランでは、Instagramの分析も追加できます。"
            />
            <FAQItem
              question="どのプランを選べばいいですか？"
              answer="Threadsを分析したい方は「Light」プランがおすすめです。Instagramも一緒に分析したい場合は「Standard」、予約投稿を無制限に使いたい場合は「Pro」をお選びください。すべてのプランに7日間の無料体験がついています。"
            />
            <FAQItem
              question="登録に必要なものは何ですか？"
              answer="Threadsのアカウントとクレジットカードです。申し込み後、Threadsのアカウントでログインするだけで使い始められます。"
            />
            <FAQItem
              question="無料期間中に解約したら、料金はかかりますか？"
              answer="かかりません。7日間の無料期間中に解約すれば請求は発生しません。8日目から課金が始まります。"
            />
            <FAQItem
              question="データはどのくらいの期間保存されますか？"
              answer="ANALYCAでは、取得したデータを無期限で保存します。過去の投稿データも、いつでも参照・比較できます。"
            />
            <FAQItem
              question="解約はいつでもできますか？"
              answer="はい、いつでも解約可能です。解約後も、契約期間終了までサービスをご利用いただけます。"
            />
            <FAQItem
              question="支払い方法は何がありますか？"
              answer="クレジットカード（VISA、Mastercard、JCB、American Express）でのお支払いに対応しています。"
            />
          </div>
        </div>
      </section>

      {/* ============ 最終CTA ============ */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-purple-600 to-emerald-500">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Threadsの数字を、今日から貯めはじめる
          </h2>
          <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto">
            まずはデモアカウントで、ANALYCAのダッシュボードをお試しください。
            サンプルデータで全ての機能をご確認いただけます。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#pricing"
              className="inline-flex items-center justify-center bg-white text-purple-600 font-semibold px-8 py-4 rounded-xl hover:bg-gray-100 transition-colors shadow-lg"
            >
              7日間無料で試す
            </a>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center border-2 border-white text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/10 transition-colors"
            >
              デモダッシュボードを見る
            </Link>
          </div>
          <p className="text-white/70 text-sm mt-6">
            デモアカウントは登録不要・無料でご利用いただけます
          </p>
          <p className="text-white/90 text-sm mt-3">
            まずは情報から見たい方は
            <Link href="/media" className="underline underline-offset-4 font-semibold mx-1">Threads運用メディア</Link>
            へ
          </p>
        </div>
      </section>

      {/* ============ フッター ============ */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            {/* ロゴ */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-emerald-400 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span className="text-white font-bold">ANALYCA</span>
              </div>
              <p className="text-sm">
                Threads専用の分析ツール
              </p>
            </div>

            {/* サービス */}
            <div>
              <h4 className="text-white font-medium mb-4">サービス</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">機能</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">料金プラン</a></li>
                <li><Link href="/demo" className="hover:text-white transition-colors">デモ</Link></li>
                <li><Link href="/media" className="hover:text-white transition-colors">Threads運用メディア</Link></li>
              </ul>
            </div>

            {/* サポート */}
            <div>
              <h4 className="text-white font-medium mb-4">サポート</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#faq" className="hover:text-white transition-colors">よくある質問</a></li>
                <li><a href="mailto:support@analyca.jp" className="hover:text-white transition-colors">お問い合わせ</a></li>
              </ul>
            </div>

            {/* 法的情報 */}
            <div>
              <h4 className="text-white font-medium mb-4">法的情報</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">利用規約</a></li>
                <li><a href="#" className="hover:text-white transition-colors">プライバシーポリシー</a></li>
                <li><a href="#" className="hover:text-white transition-colors">特定商取引法に基づく表記</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2026 ANALYCA. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
