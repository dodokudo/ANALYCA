'use client';

import { useState, useEffect } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface ApiResponse {
  instagramRaw: string[][];
  storiesRaw: string[][];
  storiesProcessed: string[][];
  reelRawDataRaw: string[][];
  reelSheetRaw: string[][];
  dailyRaw: string[][];
  dataInfo: {
    instagramRows: number;
    storiesRows: number;
    storiesProcessedRows: number;
    reelRawDataRows: number;
    reelSheetRows: number;
    dailyRows: number;
  };
  error?: string;
}

// URL変換関数
const convertToGoogleUserContent = (url: string) => {
  if (!url) return '';
  const driveIdMatch = url.match(/(?:\/d\/|id=)([a-zA-Z0-9_-]+)/);
  if (driveIdMatch && driveIdMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${driveIdMatch[1]}`;
  }
  return url;
};

// toLh3関数（ストーリー用）
const toLh3 = (url: string) => {
  if (!url) return '';
  const driveIdMatch = url.match(/(?:\/d\/|id=)([a-zA-Z0-9_-]+)/);
  if (driveIdMatch && driveIdMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${driveIdMatch[1]}`;
  }
  return url;
};

// リールデータ結合関数
const joinReelData = (reelRawDataRaw: string[][], reelSheetRaw: string[][]) => {
  if (!reelRawDataRaw || !reelSheetRaw || reelRawDataRaw.length <= 1 || reelSheetRaw.length <= 1) {
    return [];
  }

  const joinedData = [];
  for (let i = 1; i < reelRawDataRaw.length; i++) {
    const rawDataRow = reelRawDataRaw[i];
    const reelId = rawDataRow[0];

    const matchingSheetRow = reelSheetRaw.find((sheetRow, index) => {
      if (index === 0) return false;
      return sheetRow[3] === reelId;
    });

    if (matchingSheetRow) {
      joinedData.push({
        rawData: rawDataRow,
        sheetData: matchingSheetRow
      });
    }
  }

  return joinedData;
};

// 日付パース関数
const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const cleanStr = dateStr.trim();
  const date = new Date(cleanStr);
  return isNaN(date.getTime()) ? null : date;
};

// パフォーマンス推移用のダミーデータ生成
const generatePerformanceData = (data: ApiResponse) => {
  const last7Days = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // ダミーデータ（実際は data.dailyRaw から計算）
    const baseFollowers = 50000 + i * 100;
    const followerIncrease = Math.floor(Math.random() * 200) + 50;
    const lineRegistrations = Math.floor(Math.random() * 20) + 5;

    last7Days.push({
      date: date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
      totalFollowers: baseFollowers,
      followerIncrease: followerIncrease,
      lineRegistrations: lineRegistrations
    });
  }

  return last7Days;
};

export default function ContentPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'reels' | 'stories'>('reels');
  const [showAllContent, setShowAllContent] = useState(false);

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/get-data');
        if (!response.ok) {
          throw new Error('データの取得に失敗しました');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-900 text-xl mb-6 font-medium">コンテンツを読み込み中...</div>
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-purple-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl border border-gray-200 max-w-2xl shadow-sm">
          <div className="text-red-600 text-xl mb-4 font-medium">{error || 'データが取得できませんでした'}</div>
          <button
            onClick={() => window.location.reload()}
            className="bg-gradient-to-r from-purple-600 to-blue-500 hover:opacity-90 text-white px-6 py-3 rounded-md font-medium transition-all duration-200 shadow-sm"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  // パフォーマンスデータ生成
  const performanceData = generatePerformanceData(data);

  // コンテンツデータ準備
  const joinedReelData = joinReelData(data.reelRawDataRaw, data.reelSheetRaw);
  const storiesData = data.storiesProcessed?.slice(1) || [];

  // 現在のタブに応じたコンテンツデータ
  const currentContentData = activeTab === 'reels' ? joinedReelData.slice(0, 10) : storiesData.slice(0, 10);
  const previewData = currentContentData.slice(0, 3);

  return (
    <div className="min-h-screen bg-white">
      {/* 固定ヘッダー */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm h-[60px]">
        <div className="flex items-center justify-between px-5 h-full max-w-md mx-auto">
          {/* 戻るボタン */}
          <button
            onClick={() => window.history.back()}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* タイトル */}
          <h1 className="text-lg font-bold text-gray-900">コンテンツ</h1>

          {/* 検索アイコン */}
          <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="pt-[60px] max-w-md mx-auto px-5 pb-8">
        {/* タブ切り替えセクション */}
        <div className="py-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('reels')}
              className={`flex-1 py-3 text-center font-medium transition-all duration-300 ${
                activeTab === 'reels'
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-500'
              }`}
            >
              リール
            </button>
            <button
              onClick={() => setActiveTab('stories')}
              className={`flex-1 py-3 text-center font-medium transition-all duration-300 ${
                activeTab === 'stories'
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-500'
              }`}
            >
              ストーリー
            </button>
          </div>
        </div>

        {/* パフォーマンス推移グラフ */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">📊 パフォーマンス推移（過去7日間）</h2>
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <div style={{ width: '335px', height: '200px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={performanceData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    axisLine={{ stroke: '#E5E7EB' }}
                    tickLine={{ stroke: '#E5E7EB' }}
                  />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    axisLine={{ stroke: '#E5E7EB' }}
                    tickLine={{ stroke: '#E5E7EB' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    axisLine={{ stroke: '#E5E7EB' }}
                    tickLine={{ stroke: '#E5E7EB' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="totalFollowers"
                    stroke="#8B5CF6"
                    strokeWidth={3}
                    dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 4 }}
                    name="総フォロワー数"
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="followerIncrease"
                    fill="#3B82F6"
                    radius={[2, 2, 0, 0]}
                    opacity={0.8}
                    name="フォロワー増加数"
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="lineRegistrations"
                    fill="#10B981"
                    radius={[2, 2, 0, 0]}
                    opacity={0.8}
                    name="LINE登録数"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 最新コンテンツプレビューまたは詳細一覧 */}
        {!showAllContent ? (
          // プレビュー表示
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">📋 最新コンテンツ</h2>
              <button
                onClick={() => setShowAllContent(true)}
                className="text-purple-600 font-medium text-sm hover:text-purple-700 transition-colors"
              >
                すべて表示
              </button>
            </div>

            {/* 横スクロールプレビュー */}
            <div className="flex space-x-3 overflow-x-auto pb-4">
              {previewData.map((item, index) => {
                if (activeTab === 'reels') {
                  const reelItem = item as { rawData: string[], sheetData: string[] };
                  return (
                    <div key={index} className="w-[100px] h-[140px] bg-white border border-gray-200 rounded-lg shadow-sm flex-shrink-0 overflow-hidden">
                      <div className="w-full aspect-[9/16] bg-gray-600 rounded-t-lg overflow-hidden relative">
                        {reelItem.rawData[15] ? (
                          <img
                            src={convertToGoogleUserContent(reelItem.rawData[15])}
                            alt={`Reel ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-600 flex items-center justify-center text-white text-xs">
                            No Image
                          </div>
                        )}
                      </div>
                      <div className="p-2 space-y-1">
                        <div className="flex items-center text-xs text-gray-900">
                          <span className="mr-1">👁️</span>
                          <span className="font-medium">{parseInt(String(reelItem.sheetData[2] || '').replace(/,/g, '')).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center text-xs text-gray-900">
                          <span className="mr-1">❤️</span>
                          <span className="font-medium">{parseInt(String(reelItem.sheetData[13] || '').replace(/,/g, '')) || 0}</span>
                        </div>
                        <div className="flex items-center text-xs text-gray-900">
                          <span className="mr-1">💬</span>
                          <span className="font-medium">{parseInt(String(reelItem.sheetData[14] || '').replace(/,/g, '')) || 0}</span>
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  const storyItem = item as string[];
                  return (
                    <div key={index} className="w-[100px] h-[140px] bg-white border border-gray-200 rounded-lg shadow-sm flex-shrink-0 overflow-hidden">
                      <div className="w-full aspect-[9/16] bg-gray-600 rounded-t-lg overflow-hidden relative">
                        {storyItem[7] ? (
                          <img
                            src={toLh3(storyItem[7])}
                            alt={`Story ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-600 flex items-center justify-center text-white text-xs">
                            No Image
                          </div>
                        )}
                      </div>
                      <div className="p-2 space-y-1">
                        <div className="flex items-center text-xs text-gray-900">
                          <span className="mr-1">👁️</span>
                          <span className="font-medium">{parseInt(String(storyItem[3] || '').replace(/,/g, '')).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center text-xs text-gray-900">
                          <span className="mr-1">📊</span>
                          <span className="font-medium">{storyItem[5] || '0%'}</span>
                        </div>
                        <div className="flex items-center text-xs text-gray-900">
                          <span className="mr-1">📱</span>
                          <span className="font-medium">{storyItem[4] || 0}</span>
                        </div>
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          </div>
        ) : (
          // 詳細一覧表示
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">📋 すべてのコンテンツ</h2>
              <button
                onClick={() => setShowAllContent(false)}
                className="text-purple-600 font-medium text-sm hover:text-purple-700 transition-colors"
              >
                プレビューに戻る
              </button>
            </div>

            {/* 詳細一覧 */}
            <div className="space-y-2">
              {currentContentData.map((item, index) => {
                if (activeTab === 'reels') {
                  const reelItem = item as { rawData: string[], sheetData: string[] };
                  return (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-start space-x-4">
                        {/* サムネイル */}
                        <div className="w-20 h-25 bg-gray-600 rounded-lg overflow-hidden flex-shrink-0">
                          {reelItem.rawData[15] ? (
                            <img
                              src={convertToGoogleUserContent(reelItem.rawData[15])}
                              alt={`Reel ${index + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-600 flex items-center justify-center text-white text-xs">
                              No Image
                            </div>
                          )}
                        </div>

                        {/* コンテンツ情報 */}
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 text-sm mb-1 line-clamp-2">
                            {reelItem.sheetData[4] || `リール ${index + 1}`}
                          </h3>
                          <p className="text-xs text-gray-500 mb-2">
                            {reelItem.rawData[1] || '日付不明'}
                          </p>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="flex items-center">
                              <span className="mr-1">👁️</span>
                              {parseInt(String(reelItem.sheetData[2] || '').replace(/,/g, '')).toLocaleString()}
                            </span>
                            <span className="flex items-center">
                              <span className="mr-1">❤️</span>
                              {parseInt(String(reelItem.sheetData[13] || '').replace(/,/g, '')) || 0}
                            </span>
                            <span className="flex items-center">
                              <span className="mr-1">💬</span>
                              {parseInt(String(reelItem.sheetData[14] || '').replace(/,/g, '')) || 0}
                            </span>
                            <span className="flex items-center">
                              <span className="mr-1">📁</span>
                              {parseInt(String(reelItem.sheetData[16] || '').replace(/,/g, '')) || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  const storyItem = item as string[];
                  return (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-start space-x-4">
                        {/* サムネイル */}
                        <div className="w-20 h-25 bg-gray-600 rounded-lg overflow-hidden flex-shrink-0">
                          {storyItem[7] ? (
                            <img
                              src={toLh3(storyItem[7])}
                              alt={`Story ${index + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-600 flex items-center justify-center text-white text-xs">
                              No Image
                            </div>
                          )}
                        </div>

                        {/* コンテンツ情報 */}
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 text-sm mb-1 line-clamp-2">
                            {storyItem[0] || `ストーリー ${index + 1}`}
                          </h3>
                          <p className="text-xs text-gray-500 mb-2">
                            {storyItem[0] || '日付不明'}
                          </p>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="flex items-center">
                              <span className="mr-1">👁️</span>
                              {parseInt(String(storyItem[3] || '').replace(/,/g, '')).toLocaleString()}
                            </span>
                            <span className="flex items-center">
                              <span className="mr-1">📊</span>
                              {storyItem[5] || '0%'}
                            </span>
                            <span className="flex items-center">
                              <span className="mr-1">📱</span>
                              {storyItem[4] || 0}
                            </span>
                            <span className="flex items-center">
                              <span className="mr-1">↪️</span>
                              {storyItem[6] || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}