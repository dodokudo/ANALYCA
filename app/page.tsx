'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AnalycaLogo from '@/components/AnalycaLogo';

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

// ============ モックアップコンポーネント ============
function DashboardMockup() {
  return (
    <div className="relative">
      {/* PCモックアップ */}
      <div className="hidden md:block relative">
        <div className="bg-gray-800 rounded-t-xl pt-3 px-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
        </div>
        <div className="bg-white border-x-4 border-b-4 border-gray-800 rounded-b-xl overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-r from-pink-50/70 via-blue-50/50 to-teal-50/30 p-4">
            {/* ヘッダー */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-emerald-400 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-sm font-bold text-gray-800">ANALYCA</span>
            </div>
            {/* コンテンツ */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <p className="text-[10px] text-gray-500">投稿数</p>
                <p className="text-lg font-bold text-gray-900">128</p>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <p className="text-[10px] text-gray-500">閲覧数</p>
                <p className="text-lg font-bold text-gray-900">245K</p>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <p className="text-[10px] text-gray-500">いいね</p>
                <p className="text-lg font-bold text-gray-900">18.2K</p>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <p className="text-[10px] text-gray-500">エンゲージ率</p>
                <p className="text-lg font-bold text-gray-900">4.8%</p>
              </div>
            </div>
            {/* グラフエリア */}
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <p className="text-xs font-semibold text-gray-800 mb-2">インプレッション推移</p>
              <div className="h-24 flex items-end gap-1">
                {[40, 65, 45, 80, 55, 90, 70, 85, 95, 75, 88, 100].map((h, i) => (
                  <div key={i} className="flex-1 bg-gradient-to-t from-purple-500 to-emerald-400 rounded-t" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* スマホモックアップ */}
      <div className="md:absolute md:-right-8 md:-bottom-8 md:w-48">
        <div className="mx-auto w-48 md:w-full">
          <div className="bg-gray-900 rounded-[2rem] p-2 shadow-2xl">
            <div className="bg-white rounded-[1.5rem] overflow-hidden">
              {/* ノッチ */}
              <div className="bg-gray-900 h-6 flex items-center justify-center">
                <div className="w-16 h-4 bg-black rounded-full" />
              </div>
              {/* コンテンツ */}
              <div className="bg-gradient-to-r from-pink-50/70 via-blue-50/50 to-teal-50/30 p-3 h-72">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-emerald-400 rounded-md flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <span className="text-xs font-bold text-gray-800">ANALYCA</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-white rounded-lg p-2 shadow-sm">
                    <p className="text-[8px] text-gray-500">フォロワー</p>
                    <p className="text-sm font-bold text-gray-900">8,320</p>
                    <p className="text-[8px] text-green-500">+89</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 shadow-sm">
                    <p className="text-[8px] text-gray-500">閲覧数</p>
                    <p className="text-sm font-bold text-gray-900">29.4K</p>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-2 shadow-sm">
                  <p className="text-[8px] font-semibold text-gray-800 mb-1">トップ投稿</p>
                  <div className="space-y-1">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-2 text-[8px]">
                        <span className="w-4 h-4 bg-amber-100 rounded text-amber-700 flex items-center justify-center font-bold">{i}</span>
                        <span className="text-gray-600 truncate flex-1">投稿テキスト...</span>
                        <span className="text-gray-800 font-medium">12.5K</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* ホームバー */}
              <div className="h-4 flex items-center justify-center">
                <div className="w-24 h-1 bg-gray-300 rounded-full" />
              </div>
            </div>
          </div>
        </div>
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

// ============ メインコンポーネント ============
export default function HomePage() {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    const userId = window.localStorage.getItem('analycaUserId');
    if (userId) {
      setIsRedirecting(true);
      router.push(`/${userId}`);
    }
  }, [router]);

  if (isRedirecting) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">ダッシュボードへ移動中...</p>
        </div>
      </div>
    );
  }

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
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/demo" className="hidden md:block text-sm text-gray-600 hover:text-gray-900 transition-colors">
              デモを見る
            </Link>
            <Link
              href="/pricing"
              className="bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-600 hover:to-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all"
            >
              無料で始める
            </Link>
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
                <InstagramIcon className="w-4 h-4" />
                <span>+</span>
                <ThreadsIcon className="w-4 h-4" />
                <span>SNS分析ツール</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-6">
                SNSデータを
                <span className="bg-gradient-to-r from-purple-500 to-emerald-400 bg-clip-text text-transparent">見える化</span>
                して、<br />
                成果を最大化する
              </h1>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                InstagramとThreadsのインサイトを自動で取得・分析。
                投稿パフォーマンスやフォロワー推移をダッシュボードで一目で確認できます。
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center bg-gradient-to-r from-purple-500 to-emerald-400 hover:from-purple-600 hover:to-emerald-500 text-white font-semibold px-8 py-4 rounded-xl transition-all shadow-lg shadow-purple-500/25"
                >
                  無料で始める
                </Link>
                <Link
                  href="/demo"
                  className="inline-flex items-center justify-center border-2 border-gray-200 text-gray-700 font-semibold px-8 py-4 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  デモダッシュボードを見る
                </Link>
              </div>
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
              SNS運用の課題を解決する
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              手作業でのデータ収集や分析にかかる時間を削減し、より戦略的なSNS運用を実現します
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
              <h3 className="text-xl font-bold text-gray-900 mb-3">作業時間を90%削減</h3>
              <p className="text-gray-600">
                スクリーンショットや手入力でのデータ収集は不要。APIで自動取得し、分析までワンストップで完結します。
              </p>
            </div>

            {/* データの蓄積 */}
            <div className="bg-gradient-to-br from-emerald-50 to-white p-8 rounded-2xl border border-emerald-100">
              <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">過去データを蓄積・比較</h3>
              <p className="text-gray-600">
                Instagram標準インサイトでは90日で消えるデータも、ANALYCAなら無期限で保存。長期トレンドの分析が可能です。
              </p>
            </div>

            {/* わかりやすい */}
            <div className="bg-gradient-to-br from-blue-50 to-white p-8 rounded-2xl border border-blue-100">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">直感的なダッシュボード</h3>
              <p className="text-gray-600">
                複雑な設定は不要。見やすいグラフとランキングで、どの投稿が効果的かが一目でわかります。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 機能紹介 ============ */}
      <section id="features" className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              主な機能
            </h2>
            <p className="text-gray-600 text-lg">
              Instagram・Threadsの分析に必要な機能を網羅
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '📊', title: 'フォロワー推移グラフ', desc: '日別のフォロワー増減を可視化。成長トレンドを把握' },
              { icon: '🏆', title: '投稿ランキング', desc: '閲覧数・いいね数で投稿をランキング表示' },
              { icon: '📈', title: 'エンゲージメント分析', desc: 'いいね、コメント、保存数からエンゲージメント率を算出' },
              { icon: '🎬', title: 'リール分析', desc: '再生数、リーチ、平均視聴時間などを詳細分析' },
              { icon: '📱', title: 'ストーリー分析', desc: '閲覧率、返信数、離脱率などを計測' },
              { icon: '🧵', title: 'Threads分析', desc: 'コメント欄の遷移率など、Threads独自の指標を分析' },
            ].map((feature, i) => (
              <div key={i} className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="text-3xl mb-4">{feature.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.desc}</p>
              </div>
            ))}
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
                <p className="text-gray-600">Instagram Graph API、Threads APIを正式に利用。安全かつ正確なデータを取得します。</p>
              </div>
            </div>
            <div className="flex gap-6 items-start p-6 rounded-2xl bg-emerald-50 border border-emerald-100">
              <div className="text-4xl font-bold text-emerald-300">02</div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">設定かんたん、すぐ使える</h3>
                <p className="text-gray-600">アクセストークンを入力するだけで設定完了。複雑な初期設定は不要です。</p>
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

      {/* ============ 料金プラン ============ */}
      <section id="pricing" className="py-16 md:py-24 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              料金プラン
            </h2>
            <p className="text-gray-600 text-lg">
              分析したいプラットフォームに合わせて選べる3つのプラン
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Light Threads */}
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-purple-300 transition-colors">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <ThreadsIcon className="w-5 h-5" />
                  <span className="text-sm text-gray-500">Threads専用</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Light</h3>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">¥4,980</span>
                <span className="text-gray-500">/月</span>
              </div>
              <ul className="space-y-3 mb-6">
                {['Threads投稿分析', 'フォロワー推移', 'コメント欄遷移分析', 'データ無期限保存'].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckIcon className="w-5 h-5 text-emerald-500" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/checkout?plan=light-threads"
                className="block w-full text-center bg-gray-100 text-gray-800 font-medium py-3 rounded-lg hover:bg-gray-200 transition-colors"
              >
                このプランを選択
              </Link>
            </div>

            {/* Light Instagram */}
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-pink-300 transition-colors">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <InstagramIcon className="w-5 h-5" />
                  <span className="text-sm text-gray-500">Instagram専用</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Light</h3>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">¥4,980</span>
                <span className="text-gray-500">/月</span>
              </div>
              <ul className="space-y-3 mb-6">
                {['リール・ストーリー分析', 'フォロワー推移', 'エンゲージメント分析', 'データ無期限保存'].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckIcon className="w-5 h-5 text-emerald-500" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/checkout?plan=light-instagram"
                className="block w-full text-center bg-gray-100 text-gray-800 font-medium py-3 rounded-lg hover:bg-gray-200 transition-colors"
              >
                このプランを選択
              </Link>
            </div>

            {/* Standard */}
            <div className="bg-white rounded-2xl border-2 border-purple-500 p-6 relative shadow-lg scale-105">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-gradient-to-r from-purple-500 to-emerald-400 text-white text-sm font-medium px-4 py-1 rounded-full">
                  人気
                </span>
              </div>
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <InstagramIcon className="w-5 h-5" />
                  <span className="text-gray-400">+</span>
                  <ThreadsIcon className="w-5 h-5" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Standard</h3>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">¥9,800</span>
                <span className="text-gray-500">/月</span>
              </div>
              <ul className="space-y-3 mb-6">
                {['Instagram + Threads両方', 'クロスプラットフォーム分析', '全投稿タイプ対応', 'データ無期限保存', '優先サポート'].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckIcon className="w-5 h-5 text-emerald-500" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/checkout?plan=standard"
                className="block w-full text-center bg-gradient-to-r from-purple-500 to-emerald-400 text-white font-medium py-3 rounded-lg hover:from-purple-600 hover:to-emerald-500 transition-all"
              >
                このプランを選択
              </Link>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 mt-8">
            すべてのプランは月額課金です。いつでも解約できます。
          </p>
        </div>
      </section>

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
              answer="ANALYCAは、InstagramとThreadsのインサイトデータを自動で取得・分析するSNS分析ツールです。投稿のパフォーマンス、フォロワー推移、エンゲージメント率などを可視化し、効果的なSNS運用をサポートします。"
            />
            <FAQItem
              question="どのプランを選べばいいですか？"
              answer="Threadsのみ分析したい場合は「Light（Threads）」、Instagramのみの場合は「Light（Instagram）」をお選びください。両方のプラットフォームを分析したい場合は「Standard」プランがおすすめです。"
            />
            <FAQItem
              question="登録に必要なものは何ですか？"
              answer="各プラットフォームのアクセストークンが必要です。取得方法は登録時のガイドで詳しく説明しています。Metaビジネスアカウントをお持ちであれば、数分で設定できます。"
            />
            <FAQItem
              question="データはどのくらいの期間保存されますか？"
              answer="ANALYCAでは、取得したデータを無期限で保存します。Instagram標準のインサイトは90日で消えてしまいますが、ANALYCAなら過去のデータもいつでも参照・比較できます。"
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
            今すぐSNS分析を始めましょう
          </h2>
          <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto">
            まずはデモアカウントで、ANALYCAのダッシュボードをお試しください。
            サンプルデータで全ての機能をご確認いただけます。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center bg-white text-purple-600 font-semibold px-8 py-4 rounded-xl hover:bg-gray-100 transition-colors shadow-lg"
            >
              プランを選んで始める
            </Link>
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
                Instagram & Threads分析ツール
              </p>
            </div>

            {/* サービス */}
            <div>
              <h4 className="text-white font-medium mb-4">サービス</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">機能</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">料金プラン</a></li>
                <li><Link href="/demo" className="hover:text-white transition-colors">デモ</Link></li>
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
            <p>&copy; 2024 ANALYCA. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
