'use client';

import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ApiResponse {
  instagramRaw: any[][];
  storiesRaw: any[][];
  reelRawDataRaw: any[][];
  reelSheetRaw: any[][];
  dailyRaw: any[][];
  dataInfo: {
    instagramRows: number;
    storiesRows: number;
    reelRawDataRows: number;
    reelSheetRows: number;
    dailyRows: number;
  };
  error?: string;
}

function KPICard({ title, value, change, icon }: { title: string; value: string; change?: string; icon: string }) {
  return (
    <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl p-6 backdrop-blur-sm border border-white/10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-300 text-sm">{title}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
          {change && <p className="text-sm text-green-400">{change}</p>}
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
          icon === 'F' ? 'bg-purple-500' :
          icon === 'R' ? 'bg-blue-500' :
          icon === 'P' ? 'bg-green-500' :
          icon === 'W' ? 'bg-orange-500' :
          'bg-green-600'
        }`}>
          <span className="text-white font-bold">{icon}</span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<ApiResponse>({
    instagramRaw: [],
    storiesRaw: [],
    reelRawDataRaw: [],
    reelSheetRaw: [],
    dailyRaw: [],
    dataInfo: {
      instagramRows: 0,
      storiesRows: 0,
      reelRawDataRows: 0,
      reelSheetRows: 0,
      dailyRows: 0
    }
  });
  const [activeTab, setActiveTab] = useState('main');
  const [timeFilter, setTimeFilter] = useState('1month');
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const parseDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') {
      return null;
    }

    try {
      const str = dateStr.trim();
      
      // ISO形式: "2025-06-20"
      const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (isoMatch) {
        const [, year, month, day] = isoMatch;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }

      // ISO日時形式: "2025-09-14 12:02:33"
      const isoDateTimeMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+\d{1,2}:\d{1,2}:\d{1,2}$/);
      if (isoDateTimeMatch) {
        const [, year, month, day] = isoDateTimeMatch;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }

      // スラッシュ区切り日時: "2025/09/13 9:57:01"
      const slashDateTimeMatch = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+\d{1,2}:\d{1,2}:\d{1,2}$/);
      if (slashDateTimeMatch) {
        const [, year, month, day] = slashDateTimeMatch;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }

      // スラッシュ区切り日付のみ: "2025/09/13"
      const slashDateMatch = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
      if (slashDateMatch) {
        const [, year, month, day] = slashDateMatch;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }

      return null;
    } catch (error) {
      console.error('parseDate エラー:', error, '元値:', dateStr);
      return null;
    }
  };

  const getFilteredData = (data, timeFilter, dateColumnIndex = 0) => {
    if (!data || data.length <= 1 || timeFilter === 'all') {
      return data || [];
    }
    
    try {
      const dataRows = data.slice(1);
      
      let latestDate = null;
      
      for (let i = 0; i < Math.min(10, dataRows.length); i++) {
        const row = dataRows[i];
        if (row && row[dateColumnIndex]) {
          const date = parseDate(row[dateColumnIndex]);
          if (date && !isNaN(date.getTime())) {
            if (!latestDate || date > latestDate) {
              latestDate = date;
            }
          }
        }
      }
      
      if (!latestDate) {
        return data;
      }
      
      let startDate;
      const millisecondsPerDay = 24 * 60 * 60 * 1000;
      
      switch (timeFilter) {
        case '1week':
          startDate = new Date(latestDate.getTime() - 7 * millisecondsPerDay);
          break;
        case '1month':
          startDate = new Date(latestDate.getTime() - 30 * millisecondsPerDay);
          break;
        case '3months':
          startDate = new Date(latestDate.getTime() - 90 * millisecondsPerDay);
          break;
        case '1year':
          startDate = new Date(latestDate.getTime() - 365 * millisecondsPerDay);
          break;
        default:
          return data;
      }
      
      const headerRows = data.slice(0, 1);
      const filteredRows = dataRows.filter(row => {
        if (!row || !row[dateColumnIndex]) return false;
        const date = parseDate(row[dateColumnIndex]);
        return date && !isNaN(date.getTime()) && date >= startDate && date <= latestDate;
      });
      
      return [...headerRows, ...filteredRows];
    } catch (error) {
      console.error('フィルタリングエラー:', error);
      return data;
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('実際のスプレッドシートからデータを取得中...');
      
      const response = await fetch('/api/data', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers.get('content-type'));
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('非JSON応答:', text.substring(0, 500));
        throw new Error('サーバーから無効な応答形式が返されました');
      }
      
      const result = await response.json();
      
      if (result.error) {
        console.error('API returned error:', result);
        setError(`エラー: ${result.error} (${result.details || '詳細不明'})`);
        return;
      }
      
      console.log('取得したデータ:', {
        instagram: result.instagramRaw?.length || 0,
        stories: result.storiesRaw?.length || 0,
        reelRaw: result.reelRawDataRaw?.length || 0,
        reelSheet: result.reelSheetRaw?.length || 0,
        daily: result.dailyRaw?.length || 0
      });
      
      setData(result);
    } catch (error) {
      console.error('データ取得エラー:', error);
      setError(`データ取得に失敗しました: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = () => {
    try {
      const filteredInstagramRaw = getFilteredData(data.instagramRaw, timeFilter, 0);
      const filteredDailyRaw = getFilteredData(data.dailyRaw, timeFilter, 0);

      let summary = {
        currentFollowers: 0,
        followerGrowth: 0,
        latestReach: 0,
        latestProfileViews: 0,
        latestWebsiteClicks: 0,
        totalStories: 0,
        totalReels: 0,
        lineRegistrations: 0,
      };
      
      if (filteredInstagramRaw && filteredInstagramRaw.length > 1) {
        const dataRows = filteredInstagramRaw.slice(1);
        
        let followerValues = [];
        let reachTotal = 0;
        let profileViewsTotal = 0;
        let webClicksTotal = 0;
        
        dataRows.forEach((row) => {
          const followers = parseInt(String(row[1] || '').replace(/,/g, '')) || 0;
          if (followers > 0) {
            followerValues.push(followers);
          }
          
          const reach = parseInt(String(row[2] || '').replace(/,/g, '')) || 0;
          reachTotal += reach;
          
          const profileViews = parseInt(String(row[3] || '').replace(/,/g, '')) || 0;
          profileViewsTotal += profileViews;
          
          const webClicks = parseInt(String(row[4] || '').replace(/,/g, '')) || 0;
          webClicksTotal += webClicks;
        });
        
        if (followerValues.length > 0) {
          summary.currentFollowers = Math.max(...followerValues);
          const minFollowers = Math.min(...followerValues);
          summary.followerGrowth = summary.currentFollowers - minFollowers;
        }
        
        summary.latestReach = reachTotal;
        summary.latestProfileViews = profileViewsTotal;
        summary.latestWebsiteClicks = webClicksTotal;
      }
      
      // LINE登録者数の合計計算
      if (filteredDailyRaw && filteredDailyRaw.length > 1) {
        const dataRows = filteredDailyRaw.slice(1);
        let lineTotal = 0;
        
        dataRows.forEach((row) => {
          const lineValue = parseInt(String(row[14] || '').replace(/,/g, '')) || 0;
          lineTotal += lineValue;
        });
        
        summary.lineRegistrations = lineTotal;
      }

      const filteredStoriesRaw = getFilteredData(data.storiesRaw, timeFilter, 0);
      const filteredReelRawDataRaw = getFilteredData(data.reelRawDataRaw, timeFilter, 0);
      
      summary.totalStories = filteredStoriesRaw && filteredStoriesRaw.length > 1 ? filteredStoriesRaw.length - 1 : 0;
      summary.totalReels = filteredReelRawDataRaw && filteredReelRawDataRaw.length > 1 ? filteredReelRawDataRaw.length - 1 : 0;

      return summary;
    } catch (error) {
      console.error('KPI計算エラー:', error);
      
      return {
        currentFollowers: 0,
        followerGrowth: 0,
        latestReach: 0,
        latestProfileViews: 0,
        latestWebsiteClicks: 0,
        totalStories: 0,
        totalReels: 0,
        lineRegistrations: 0,
      };
    }
  };

  const summary = calculateSummary();

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">読み込み中...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Googleスプレッドシートからデータを取得中...</div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center bg-red-900/20 p-8 rounded-lg border border-red-500/50 max-w-2xl">
          <div className="text-red-400 text-xl mb-4">{error}</div>
          <button 
            onClick={fetchData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mr-4"
          >
            再試行
          </button>
          <button 
            onClick={() => setActiveTab('debug')}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
          >
            デバッグ情報を見る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">GEM QUEEN</h1>
          <p className="text-purple-200">Instagram Analytics Dashboard</p>
          <p className="text-xs text-gray-400 mt-2">
            データ: Instagram({data.dataInfo.instagramRows}行) | Stories({data.dataInfo.storiesRows}行) | 
            Reels({data.dataInfo.reelRawDataRows}行) | Daily({data.dataInfo.dailyRows}行)
          </p>
        </div>

        {/* Time Filter */}
        <div className="mb-6 flex justify-center">
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-2 flex space-x-2">
            {[
              { key: '1week', label: '1週間' },
              { key: '1month', label: '1ヶ月' },
              { key: '3months', label: '3ヶ月' },
              { key: '1year', label: '1年' },
              { key: 'all', label: '全期間' }
            ].map(filter => (
              <button
                key={filter.key}
                onClick={() => setTimeFilter(filter.key)}
                className={`px-4 py-2 rounded-md transition-all ${
                  timeFilter === filter.key
                    ? 'bg-purple-500 text-white'
                    : 'text-purple-200 hover:bg-white/10'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          <button
            className={`px-6 py-3 rounded-lg ${activeTab === 'main' ? 'bg-white text-purple-900' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
            onClick={() => setActiveTab('main')}
          >
            メインダッシュボード
          </button>
          <button
            className={`px-4 py-2 rounded-lg ${activeTab === 'reels' ? 'bg-pink-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
            onClick={() => setActiveTab('reels')}
          >
            リール詳細 ({summary.totalReels}件)
          </button>
          <button
            className={`px-4 py-2 rounded-lg ${activeTab === 'stories' ? 'bg-pink-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
            onClick={() => setActiveTab('stories')}
          >
            ストーリー詳細 ({summary.totalStories}件)
          </button>
          <button
            className={`px-4 py-2 rounded-lg ${activeTab === 'daily' ? 'bg-pink-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
            onClick={() => setActiveTab('daily')}
          >
            デイリーデータ
          </button>
          <button
            className={`px-4 py-2 rounded-lg ${activeTab === 'debug' ? 'bg-green-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
            onClick={() => setActiveTab('debug')}
          >
            デバッグ情報
          </button>
        </div>

        {/* Main Dashboard */}
        {activeTab === 'main' && (
          <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <KPICard
                title="フォロワー数"
                value={summary.currentFollowers.toLocaleString()}
                change={summary.followerGrowth > 0 ? `+${summary.followerGrowth}` : `${summary.followerGrowth}`}
                icon="F"
              />
              <KPICard
                title="リーチ数"
                value={summary.latestReach.toLocaleString()}
                icon="R"
              />
              <KPICard
                title="プロフィール表示"
                value={summary.latestProfileViews.toLocaleString()}
                icon="P"
              />
              <KPICard
                title="Webクリック数"
                value={summary.latestWebsiteClicks.toLocaleString()}
                icon="W"
              />
              <KPICard
                title="LINE登録者数"
                value={summary.lineRegistrations.toLocaleString()}
                change="期間内合計"
                icon="L"
              />
            </div>

            {/* フォロワー推移グラフ */}
            {(() => {
              const filteredInstagramRaw = getFilteredData(data.instagramRaw, timeFilter, 0);
              return filteredInstagramRaw.length > 1 && (
                <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl p-6 backdrop-blur-sm border border-white/10">
                  <h3 className="text-xl font-semibold text-white mb-4">フォロワー推移</h3>
                  <div className="h-64">
                    <Line 
                      data={{
                        labels: filteredInstagramRaw.slice(1).map(row => {
                          try {
                            return new Date(row[0]).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
                          } catch {
                            return row[0];
                          }
                        }),
                        datasets: [{
                          label: 'フォロワー数',
                          data: filteredInstagramRaw.slice(1).map(row => parseInt(String(row[1] || '').replace(/,/g, '')) || 0),
                          borderColor: 'rgb(147, 51, 234)',
                          backgroundColor: 'rgba(147, 51, 234, 0.1)',
                          tension: 0.1,
                          fill: true,
                        }],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { labels: { color: '#fff' } }
                        },
                        scales: {
                          x: { ticks: { color: '#fff' } },
                          y: { ticks: { color: '#fff' } }
                        }
                      }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Top 5 Reels */}
            <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl p-6 backdrop-blur-sm border border-white/10">
              <h3 className="text-xl font-semibold text-white mb-4">トップ5 リール</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {(() => {
                  const filteredReelRawDataRaw = getFilteredData(data.reelRawDataRaw, timeFilter, 0);
                  const filteredReelSheetRaw = data.reelSheetRaw;
                  
                  if (filteredReelRawDataRaw.length > 1) {
                    const sortedReels = filteredReelRawDataRaw.slice(1).sort((a, b) => {
                      const viewsA = parseInt(String(a[2] || '').replace(/,/g, '')) || 0;
                      const viewsB = parseInt(String(b[2] || '').replace(/,/g, '')) || 0;
                      return viewsB - viewsA;
                    }).slice(0, 5);
                    
                    return sortedReels.map((reel, index) => (
                      <div key={index} className="bg-white/5 rounded-lg p-3 text-center">
                        <div className="w-full aspect-[9/16] bg-gray-600 rounded-lg flex items-center justify-center text-white text-xs mb-2">
                          Reel {index + 1}
                        </div>
                        <p className="text-white text-xs mb-2">{filteredReelSheetRaw[index + 1]?.[0] || `リール ${index + 1}`}</p>
                        <div className="space-y-1">
                          <p className="text-gray-300 text-xs">再生数：<span className="text-white font-bold">{parseInt(String(reel[2] || '').replace(/,/g, '')).toLocaleString()}</span></p>
                          <p className="text-green-400 text-xs">いいね：{reel[4] || 0}</p>
                          <p className="text-blue-400 text-xs">保存：{reel[6] || 0}</p>
                          <p className="text-purple-400 text-xs">パフォーマンス：{filteredReelSheetRaw[index + 1]?.[4] || 'N/A'}</p>
                        </div>
                      </div>
                    ));
                  } else {
                    return <p className="text-gray-400 text-center col-span-full">データがありません</p>;
                  }
                })()}
              </div>
            </div>

            {/* Top 5 Stories */}
            <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl p-6 backdrop-blur-sm border border-white/10">
              <h3 className="text-xl font-semibold text-white mb-4">トップ5 ストーリー</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {(() => {
                  const filteredStoriesRaw = getFilteredData(data.storiesRaw, timeFilter, 0);
                  if (filteredStoriesRaw.length > 1) {
                    const sortedStories = filteredStoriesRaw.slice(1).sort((a, b) => {
                      const viewsA = parseInt(String(a[3] || '').replace(/,/g, '')) || 0;
                      const viewsB = parseInt(String(b[3] || '').replace(/,/g, '')) || 0;
                      return viewsB - viewsA;
                    }).slice(0, 5);
                    
                    return sortedStories.map((story, index) => (
                      <div key={index} className="bg-white/5 rounded-lg p-3 text-center">
                        <div className="w-full aspect-[9/16] bg-gray-600 rounded-lg flex items-center justify-center text-white text-xs mb-3">
                          Story {index + 1}
                        </div>
                        <p className="text-white text-xs mb-2">{story[0] || `ストーリー ${index + 1}`}</p>
                        <div className="space-y-1">
                          <p className="text-gray-300 text-xs">表示数：<span className="text-white font-bold">{parseInt(String(story[3] || '').replace(/,/g, '')).toLocaleString()}</span></p>
                          <p className="text-blue-400 text-xs">閲覧率：{story[5] || 'N/A'}</p>
                          <p className="text-green-400 text-xs">返信数：{story[4] || 0}</p>
                        </div>
                      </div>
                    ));
                  } else {
                    return <p className="text-gray-400 text-center col-span-full">データがありません</p>;
                  }
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Debug Tab */}
        {activeTab === 'debug' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl p-6 backdrop-blur-sm border border-white/10">
              <h3 className="text-xl font-semibold text-white mb-4">スプレッドシート接続状況</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-white font-semibold mb-2">取得データ行数:</h4>
                  <ul className="text-gray-300 space-y-1">
                    <li>Instagram Raw: {data.dataInfo.instagramRows}行</li>
                    <li>Stories Raw: {data.dataInfo.storiesRows}行</li>
                    <li>Reel Raw Data: {data.dataInfo.reelRawDataRows}行</li>
                    <li>Reel Sheet: {data.dataInfo.reelSheetRows}行</li>
                    <li>Daily: {data.dataInfo.dailyRows}行</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-2">サンプルデータ:</h4>
                  <div className="text-gray-300 text-sm">
                    <div className="mb-2">
                      <strong>Instagram Raw ヘッダー:</strong>
                      <pre className="text-xs mt-1 bg-black/20 p-2 rounded overflow-x-auto">
                        {JSON.stringify(data.instagramRaw?.[0] || 'データなし', null, 2)}
                      </pre>
                    </div>
                    {data.instagramRaw?.length > 1 && (
                      <div>
                        <strong>Instagram Raw データ例:</strong>
                        <pre className="text-xs mt-1 bg-black/20 p-2 rounded overflow-x-auto">
                          {JSON.stringify(data.instagramRaw[1], null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <button 
                onClick={fetchData}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              >
                データを再取得
              </button>
            </div>
          </div>
        )}

        {/* Reels Detail */}
        {activeTab === 'reels' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl p-6 backdrop-blur-sm border border-white/10">
              <h3 className="text-xl font-semibold text-white mb-4">リール詳細 ({summary.totalReels}件)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {(() => {
                  const filteredReelRawDataRaw = getFilteredData(data.reelRawDataRaw, timeFilter, 0);
                  return filteredReelRawDataRaw && filteredReelRawDataRaw.length > 1 ? (
                    filteredReelRawDataRaw.slice(1).map((reel, index) => (
                      <div key={index} className="bg-white/5 rounded-lg p-4 text-center">
                        <div className="w-full aspect-[9/16] bg-gray-600 rounded-lg flex items-center justify-center text-white text-xs mb-3">
                          Reel {index + 1}
                        </div>
                        <p className="text-white text-xs mb-2">{data.reelSheetRaw[index + 1]?.[0] || `リール ${index + 1}`}</p>
                        <div className="space-y-1">
                          <p className="text-gray-300 text-xs">再生数：<span className="text-white font-bold">{parseInt(String(reel[2] || '0').replace(/,/g, '')).toLocaleString()}</span></p>
                          <p className="text-green-400 text-xs">いいね：{reel[4] || 0}</p>
                          <p className="text-blue-400 text-xs">保存：{reel[6] || 0}</p>
                          <p className="text-purple-400 text-xs">コメント：{reel[5] || 0}</p>
                          <p className="text-orange-400 text-xs">パフォーマンス：{data.reelSheetRaw[index + 1]?.[4] || 'N/A'}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400 text-center col-span-full">データがありません</p>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Stories Detail */}
        {activeTab === 'stories' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl p-6 backdrop-blur-sm border border-white/10">
              <h3 className="text-xl font-semibold text-white mb-4">ストーリー詳細 ({summary.totalStories}件)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {(() => {
                  const filteredStoriesRaw = getFilteredData(data.storiesRaw, timeFilter, 0);
                  return filteredStoriesRaw && filteredStoriesRaw.length > 1 ? (
                    filteredStoriesRaw.slice(1).map((story, index) => (
                      <div key={index} className="bg-white/5 rounded-lg p-4 text-center">
                        <div className="w-full aspect-[9/16] bg-gray-600 rounded-lg flex items-center justify-center text-white text-xs mb-3">
                          Story {index + 1}
                        </div>
                        <p className="text-white text-xs mb-2">{story[0] || `ストーリー ${index + 1}`}</p>
                        <div className="space-y-1">
                          <p className="text-gray-300 text-xs">リーチ：<span className="text-white font-semibold">{parseInt(String(story[2] || '').replace(/,/g, '')).toLocaleString()}</span></p>
                          <p className="text-blue-400 text-xs">表示数：{parseInt(String(story[3] || '').replace(/,/g, '')).toLocaleString()}</p>
                          <p className="text-green-400 text-xs">返信数：{story[4] || 0}</p>
                          <p className="text-purple-400 text-xs">閲覧率：{story[5] || 'N/A'}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400 text-center col-span-full">データがありません</p>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Daily Data Detail */}
        {activeTab === 'daily' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl p-6 backdrop-blur-sm border border-white/10">
              <h3 className="text-xl font-semibold text-white mb-4">デイリーデータ - 絞込期間: {timeFilter === '1week' ? '1週間' : timeFilter === '1month' ? '1ヶ月' : timeFilter === '3months' ? '3ヶ月' : timeFilter === '1year' ? '1年' : '全期間'}</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/20">
                      {data.dailyRaw && data.dailyRaw.length > 0 && data.dailyRaw[0].map((header, index) => (
                        <th key={index} className="text-left text-white text-xs p-2 min-w-[120px]">
                          {header || '---'}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredDailyRaw = getFilteredData(data.dailyRaw, timeFilter, 0);
                      
                      if (filteredDailyRaw && filteredDailyRaw.length > 1) {
                        const dataRows = filteredDailyRaw.slice(1);
                        
                        if (dataRows.length === 0) {
                          return (
                            <tr>
                              <td colSpan={data.dailyRaw[0]?.length || 15} className="text-yellow-400 text-center p-8">
                                {timeFilter === 'all' ? 'データがありません' : `選択された期間（${timeFilter === '1week' ? '1週間' : timeFilter === '1month' ? '1ヶ月' : timeFilter === '3months' ? '3ヶ月' : '1年'}）に該当するデータがありません`}
                              </td>
                            </tr>
                          );
                        }
                        
                        return dataRows.map((row, index) => (
                          <tr key={index} className="border-b border-white/10 hover:bg-white/5">
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex} className="text-white text-xs p-2">
                                {cell || '---'}
                              </td>
                            ))}
                          </tr>
                        ));
                      } else {
                        return (
                          <tr>
                            <td colSpan={data.dailyRaw[0]?.length || 15} className="text-red-400 text-center p-8">
                              データが取得できません
                            </td>
                          </tr>
                        );
                      }
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}