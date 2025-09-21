'use client';

import Link from 'next/link';
import { StatPill } from '@/components/StatPill';
import ProfileHeader from '@/components/ProfileHeader';
import { useDateRange, DatePreset } from '@/lib/dateRangeStore';
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

interface ApiMeta {
  requestedSource: 'gem-queen' | 'bigquery';
  source: 'gem-queen' | 'bigquery';
  manualColumns?: {
    reel: {
      title: number;
      duration: number;
      follows: number;
      followRate?: number;
    };
  };
  fallbackReason?: string;
}

interface DashboardResponse {
  meta?: ApiMeta;
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

// 日付解析関数
const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;

  try {
    const str = String(dateStr).trim();

    // YYYY-MM-DD形式
    const dashDateMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (dashDateMatch) {
      const [, year, month, day] = dashDateMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    // YYYY/MM/DD形式
    const slashDateMatch = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (slashDateMatch) {
      const [, year, month, day] = slashDateMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    // 日本語曜日付きスラッシュ区切り: "2025/6/18/(水)"
    const japaneseSlashDateMatch = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\/\([日月火水木金土]\)$/);
    if (japaneseSlashDateMatch) {
      const [, year, month, day] = japaneseSlashDateMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    return null;
  } catch (error) {
    console.error('parseDate エラー:', error, '元値:', dateStr);
    return null;
  }
};

export default function GemQueenPage() {
  const { dateRange, updatePreset } = useDateRange();
  const [data, setData] = useState<DashboardResponse>({
    instagramRaw: [],
    storiesRaw: [],
    storiesProcessed: [],
    reelRawDataRaw: [],
    reelSheetRaw: [],
    dailyRaw: [],
    dataInfo: {
      instagramRows: 0,
      storiesRows: 0,
      storiesProcessedRows: 0,
      reelRawDataRows: 0,
      reelSheetRows: 0,
      dailyRows: 0
    }
  });
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const manualReelConfig = meta?.manualColumns?.reel;

  const getManualReelFields = (sheetRow: string[]) => {
    if (!manualReelConfig) return null;

    const readValue = (index: number | undefined) => {
      if (index === undefined) return '';
      return sheetRow?.[index] ?? '';
    };

    const rawTitle = readValue(manualReelConfig.title);
    const rawDuration = readValue(manualReelConfig.duration);
    const rawFollows = readValue(manualReelConfig.follows);
    const rawFollowRate = readValue(manualReelConfig.followRate);

    const durationSeconds = parseInt(String(rawDuration).replace(/[^0-9]/g, ''), 10);
    const follows = parseInt(String(rawFollows).replace(/,/g, ''), 10);

    if (!rawTitle && !Number.isFinite(durationSeconds) && !Number.isFinite(follows) && !rawFollowRate) {
      return null;
    }

    return {
      title: rawTitle,
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
      follows: Number.isFinite(follows) ? follows : null,
      followRate: rawFollowRate
    };
  };

  // Instagram Raw Dataをフィルタリングしてチャート用データに変換
  const getFilteredInstagramData = (instagramRaw: string[][], preset: string) => {
    if (!instagramRaw || instagramRaw.length <= 1) {
      return [];
    }

    // ヘッダー行をスキップ（index 0）
    const dataRows = instagramRaw.slice(1);

    // 日付順でソート
    const sortedData = dataRows
      .filter(row => row[0] && parseDate(row[0]))
      .sort((a, b) => {
        const dateA = parseDate(a[0]);
        const dateB = parseDate(b[0]);
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
      })
      .map(row => ({
        date: row[0],
        followers: parseInt(row[1]) || 0,
        posts: parseInt(row[2]) || 0,
        reach: parseInt(row[3]?.replace(/,/g, '')) || 0,
        engagement: parseInt(row[4]) || 0,
        profileViews: parseInt(row[5]) || 0,
        websiteClicks: parseInt(row[6]) || 0
      }));

    // プリセットに応じてフィルタリング
    if (preset === 'all') {
      return sortedData;
    }

    const today = new Date();
    let cutoffDate = new Date();

    switch (preset) {
      case 'this-week':
        cutoffDate.setDate(today.getDate() - 7);
        break;
      case 'last-week':
        cutoffDate.setDate(today.getDate() - 14);
        break;
      case 'current_month':
        cutoffDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      default:
        return sortedData.slice(-30); // 直近30日
    }

    return sortedData.filter(item => {
      const itemDate = parseDate(item.date);
      return itemDate && itemDate >= cutoffDate;
    });
  };

  // リールデータをフィルタリング
  const getFilteredReelData = () => {
    if (!data?.reelRawDataRaw) return [];

    const reelData = data.reelRawDataRaw.slice(1); // ヘッダー行をスキップ

    const manualLookup = new Map<string, string[]>();
    if (data.reelSheetRaw.length > 1) {
      data.reelSheetRaw.slice(1).forEach(row => {
        const manualId = row[3] || row[0];
        if (manualId) {
          manualLookup.set(manualId, row);
        }
      });
    }

    return reelData.map((row, index) => {
      const reelId = row[0] || `reel-${index}`;
      const manualRow = manualLookup.get(reelId);
      const manualFields = manualRow ? getManualReelFields(manualRow) : null;

      return {
        id: reelId,
        caption: manualFields?.title || row[1] || '',
        type: row[2] || '',
        mediaType: row[3] || '',
        permalink: row[4] || '',
        createdAt: row[5] || '',
        views: parseInt(row[6]) || 0,
        reach: parseInt(row[7]) || 0,
        interactions: parseInt(row[8]) || 0,
        likes: parseInt(row[9]) || 0,
        comments: parseInt(row[10]) || 0,
        saves: parseInt(row[11]) || 0,
        shares: parseInt(row[12]) || 0,
        watchTime: row[13] || '',
        avgWatchTime: parseFloat(row[14]) || 0,
        imageUrl: convertToGoogleUserContent(row[15] || ''),
        displayUrl: convertToGoogleUserContent(row[16] || ''),
        manual: manualFields
      };
    }).slice(0, 10); // 直近10件
  };

  // ストーリーズデータをフィルタリング
  const getFilteredStoriesData = () => {
    if (!data?.storiesRaw) return [];

    const storiesData = data.storiesRaw.slice(1); // ヘッダー行をスキップ

    return storiesData.map((row, index) => ({
      id: row[0] || `story-${index}`,
      driveUrl: row[1] || '',
      thumbnailUrl: row[2] || '',
      timestamp: row[3] || '',
      views: parseInt(row[4]) || 0,
      reach: parseInt(row[5]) || 0,
      replies: parseInt(row[6]) || 0,
      caption: row[7] || '',
      interactions: parseInt(row[8]) || 0,
      follows: parseInt(row[9]) || 0,
      profileVisits: parseInt(row[10]) || 0,
      navigation: parseInt(row[11]) || 0
    })).slice(0, 10); // 直近10件
  };

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/data?source=gem-queen');
        const result: DashboardResponse = await response.json();

        if (result.error) {
          setError(result.error || 'データの取得に失敗しました');
          return;
        }

        setMeta(result.meta || null);
        setData(result);
        setError(null);
      } catch (err) {
        setError('サーバーエラーが発生しました');
        console.error('Error fetching GEM QUEEN data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 統計データ計算
  const getStats = () => {
    if (!data) return {
      totalPosts: 0,
      totalStories: 0,
      totalReels: 0,
      totalViews: 0,
      totalReach: 0,
      totalEngagement: 0,
      avgEngagementRate: 0
    };

    const { instagramRaw, storiesRaw, reelRawDataRaw } = data;

    // Instagram統計
    const instagramData = getFilteredInstagramData(instagramRaw, 'all');
    const totalReach = instagramData.reduce((sum, item) => sum + item.reach, 0);
    const totalEngagement = instagramData.reduce((sum, item) => sum + item.engagement, 0);
    const currentFollowers = instagramData.length > 0 ? instagramData[instagramData.length - 1].followers : 0;

    // ストーリーズ統計
    const storiesData = getFilteredStoriesData();
    const totalStoryViews = storiesData.reduce((sum, item) => sum + item.views, 0);

    // リール統計
    const reelData = getFilteredReelData();
    const totalReelViews = reelData.reduce((sum, item) => sum + item.views, 0);

    return {
      totalPosts: Math.max(0, instagramRaw.length - 1),
      totalStories: Math.max(0, storiesRaw.length - 1),
      totalReels: Math.max(0, reelRawDataRaw.length - 1),
      totalViews: totalStoryViews + totalReelViews,
      totalReach,
      totalEngagement,
      avgEngagementRate: currentFollowers > 0 ? ((totalEngagement / currentFollowers) * 100) : 0,
      currentFollowers
    };
  };

  const stats = getStats();
  const chartData = data ? getFilteredInstagramData(data.instagramRaw, dateRange.preset) : [];
  const reelData = getFilteredReelData();
  const storiesData = getFilteredStoriesData();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-gray-600">Google Sheetsからデータを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-emerald-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">エラーが発生しました</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors"
            >
              再読み込み
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-emerald-50">
      <div className="container mx-auto p-4">
        {meta?.fallbackReason && (
          <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            <p className="font-medium">情報: シートデータを表示しています</p>
            <p className="mt-1">{meta.fallbackReason}</p>
          </div>
        )}

        {/* ヘッダー */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">GEM QUEEN Dashboard</h1>
              <p className="text-gray-600 mt-2">Google Sheets連携版</p>
            </div>
            <div className="flex space-x-4">
              <Link
                href="/"
                className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors"
              >
                ANALYCA (BigQuery版)
              </Link>
            </div>
          </div>
        </div>

        {/* プロフィールヘッダー */}
        <div className="mb-6">
          <ProfileHeader userId="gem-queen-user" />
        </div>

        {/* 期間選択 */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">期間設定</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries({
              'this-week': '今週',
              'last-week': '先週',
              'current_month': '今月',
              'all': '全期間'
            }).map(([value, label]) => (
              <button
                key={value}
                onClick={() => updatePreset(value as DatePreset)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  dateRange.preset === value
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 統計サマリー */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatPill
            label="フォロワー数"
            value={stats.currentFollowers?.toLocaleString() || '0'}
            trend={0}
            className="bg-white rounded-xl shadow-sm"
          />
          <StatPill
            label="総リーチ"
            value={stats.totalReach?.toLocaleString() || '0'}
            trend={0}
            className="bg-white rounded-xl shadow-sm"
          />
          <StatPill
            label="エンゲージメント率"
            value={`${stats.avgEngagementRate?.toFixed(2) || '0'}%`}
            trend={0}
            className="bg-white rounded-xl shadow-sm"
          />
          <StatPill
            label="総ビュー数"
            value={stats.totalViews?.toLocaleString() || '0'}
            trend={0}
            className="bg-white rounded-xl shadow-sm"
          />
        </div>

        {/* パフォーマンスチャート */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">パフォーマンス推移</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="followers" fill="#8884d8" name="フォロワー数" />
                <Line yAxisId="right" type="monotone" dataKey="reach" stroke="#82ca9d" name="リーチ" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="engagement" stroke="#ff7300" name="エンゲージメント" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* リールデータテーブル */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">最新リール (直近10件)</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">サムネイル</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">キャプション</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">投稿日</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">ビュー数</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">リーチ</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">いいね</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">コメント</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">フォロー増</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">フォロー率</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">リール尺</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reelData.map(reel => (
                  <tr key={reel.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      {reel.imageUrl && (
                        <img
                          src={reel.imageUrl}
                          alt="Reel thumbnail"
                          className="w-16 h-16 object-cover rounded-lg"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                    </td>
                    <td className="px-4 py-2 max-w-xs">
                      <p className="text-sm text-gray-900 truncate" title={reel.caption}>
                        {reel.caption.slice(0, 50)}...
                      </p>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">{reel.createdAt}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{reel.views.toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{reel.reach.toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{reel.likes.toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{reel.comments.toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {reel.manual?.follows !== null && reel.manual?.follows !== undefined
                        ? reel.manual.follows.toLocaleString()
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {reel.manual?.followRate && reel.manual.followRate.trim() !== ''
                        ? reel.manual.followRate
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {reel.manual?.durationSeconds
                        ? `${reel.manual.durationSeconds}秒`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ストーリーズデータテーブル */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">最新ストーリーズ (直近10件)</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">サムネイル</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">キャプション</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">投稿日</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">ビュー数</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">リーチ</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">フォロー</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">プロフィール訪問</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {storiesData.map(story => (
                  <tr key={story.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      {story.thumbnailUrl && (
                        <img
                          src={story.thumbnailUrl}
                          alt="Story thumbnail"
                          className="w-16 h-16 object-cover rounded-lg"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                    </td>
                    <td className="px-4 py-2 max-w-xs">
                      <p className="text-sm text-gray-900 truncate" title={story.caption}>
                        {story.caption ? story.caption.slice(0, 50) + '...' : '－'}
                      </p>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">{story.timestamp}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{story.views.toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{story.reach.toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{story.follows.toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{story.profileVisits.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* データソース概要 */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">データソース概要</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Instagram Raw Data</h3>
              <p className="text-blue-700">{data?.dataInfo.instagramRows || 0} 行</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-2">Stories Raw Data</h3>
              <p className="text-green-700">{data?.dataInfo.storiesRows || 0} 行</p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="font-semibold text-purple-900 mb-2">Reel Raw Data</h3>
              <p className="text-purple-700">{data?.dataInfo.reelRawDataRows || 0} 行</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
