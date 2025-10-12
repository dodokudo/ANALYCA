'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-emerald-50">
      <div className="container mx-auto px-4 py-16">
        {/* ヘッダー */}
        <div className="text-center mb-16">
          <div className="w-24 h-24 bg-gradient-to-r from-purple-500 to-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">ANALYCA</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Instagram & Threadsデータを自動分析し、ビジネス成長をサポートします
          </p>
        </div>

        {/* メインコンテンツ */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* 新規ログイン */}
          <div className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-shadow">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">新規ログイン</h2>
            <p className="text-gray-600 mb-6">
              Facebookアカウントでログインして、Instagram & Threadsのデータを自動で取得・分析します
            </p>
            <Link
              href="/login"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors text-center"
            >
              ログインして開始
            </Link>
          </div>

          {/* Threads ダッシュボード */}
          <div className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-shadow">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-.542-1.94-1.5-3.42-2.849-4.4-1.468-1.066-3.37-1.62-5.652-1.639-2.853.02-4.96.908-6.26 2.639C4.743 6.467 4.018 8.818 4 11.982v.014c.018 3.163.743 5.511 2.157 7.222 1.3 1.575 3.405 2.394 6.257 2.438 1.852.018 3.45-.245 4.755-.752 1.434-.555 2.625-1.44 3.54-2.632.873-1.134 1.504-2.56 1.876-4.241l2.04.568c-.452 2.042-1.24 3.805-2.342 5.236-1.147 1.492-2.632 2.653-4.416 3.451-1.622.725-3.497 1.114-5.575 1.15zM12 9.75c-1.243 0-2.25 1.007-2.25 2.25s1.007 2.25 2.25 2.25 2.25-1.007 2.25-2.25-1.007-2.25-2.25-2.25zm6-3c-1.243 0-2.25 1.007-2.25 2.25s1.007 2.25 2.25 2.25 2.25-1.007 2.25-2.25-1.007-2.25-2.25-2.25z"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Threads インサイト</h2>
            <p className="text-gray-600 mb-6">
              Threads投稿のパフォーマンスを詳細に分析
            </p>
            <Link
              href="/login"
              className="block w-full bg-gray-900 hover:bg-black text-white font-semibold py-3 px-6 rounded-xl transition-colors text-center"
            >
              ログインして見る
            </Link>
          </div>
        </div>

        {/* 特徴 */}
        <div className="mt-20 max-w-5xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 text-center mb-12">主な機能</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">リアルタイム分析</h4>
              <p className="text-sm text-gray-600">Instagram & Threadsのデータを自動で取得し、リアルタイムで分析</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">詳細なインサイト</h4>
              <p className="text-sm text-gray-600">リール、ストーリーズ、投稿ごとの詳細なパフォーマンス分析</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">データ蓄積</h4>
              <p className="text-sm text-gray-600">BigQueryで大量のデータを安全に保存・管理</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
