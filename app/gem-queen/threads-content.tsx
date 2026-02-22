'use client';

import { useState, useMemo } from 'react';
import { ThreadsInsights } from '@/app/[userId]/components/threads-insights';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// ============ 型定義 ============

interface ThreadsPost {
  id: string;
  threads_id: string;
  text: string;
  timestamp: string;
  permalink?: string;
  views: number;
  likes: number;
  replies: number;
  reposts?: number;
  quotes?: number;
}

interface ThreadsComment {
  id: string;
  parent_post_id: string;
  text: string;
  views: number;
  depth: number;
}

interface DailyMetric {
  date: string;
  followers_count: number;
  follower_delta: number;
  total_views: number;
  total_likes: number;
  total_replies: number;
  post_count: number;
}

interface DailyPostStat {
  date: string;
  post_count: number;
  total_views: number;
  total_likes: number;
  total_replies: number;
}

interface ThreadsDashboardData {
  threads?: {
    total: number;
    totalViews: number;
    totalLikes: number;
    totalReplies: number;
    data: ThreadsPost[];
  };
  threadsComments?: {
    data: ThreadsComment[];
  };
  threadsDailyMetrics?: {
    data: DailyMetric[];
    latest: { followers_count: number; follower_delta: number } | null;
  };
  threadsDailyPostStats?: {
    data: DailyPostStat[];
    latest: DailyPostStat | null;
  };
}

type DatePreset = '3d' | '7d' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth';

const datePresetOptions: { value: DatePreset; label: string }[] = [
  { value: '3d', label: '過去3日' },
  { value: '7d', label: '過去7日' },
  { value: 'thisWeek', label: '今週' },
  { value: 'lastWeek', label: '先週' },
  { value: 'thisMonth', label: '今月' },
  { value: 'lastMonth', label: '先月' },
];

// ============ ユーティリティ ============

function safeFormatDate(timestamp: string | Date | null | undefined): string {
  if (!timestamp) return '-';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ja-JP');
  } catch {
    return '-';
  }
}

function safeGetTime(timestamp: string | Date | null | undefined): number {
  if (!timestamp) return 0;
  try {
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  } catch {
    return 0;
  }
}

function getDateRange(preset: DatePreset): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);

  switch (preset) {
    case '3d': {
      const start = new Date(today);
      start.setDate(start.getDate() - 2);
      return { start, end };
    }
    case '7d': {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { start, end };
    }
    case 'thisWeek': {
      const dayOfWeek = today.getDay();
      const start = new Date(today);
      start.setDate(start.getDate() - dayOfWeek);
      return { start, end };
    }
    case 'lastWeek': {
      const dayOfWeek = today.getDay();
      const start = new Date(today);
      start.setDate(start.getDate() - dayOfWeek - 7);
      const endOfLastWeek = new Date(start);
      endOfLastWeek.setDate(endOfLastWeek.getDate() + 6);
      endOfLastWeek.setHours(23, 59, 59, 999);
      return { start, end: endOfLastWeek };
    }
    case 'thisMonth': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start, end };
    }
    case 'lastMonth': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      endOfLastMonth.setHours(23, 59, 59, 999);
      return { start, end: endOfLastMonth };
    }
    default:
      return { start: new Date(0), end };
  }
}

function isDateInRange(dateStr: string | Date | null | undefined, range: { start: Date; end: Date }): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  return date >= range.start && date <= range.end;
}

// ============ コンポーネント ============

export default function GemQueenThreadsContent({
  data,
  loading,
  username,
  profilePicture,
}: {
  data: ThreadsDashboardData | null;
  loading: boolean;
  username: string;
  profilePicture?: string;
}) {
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'date' | 'views' | 'likes'>('views');
  const [showAllPosts, setShowAllPosts] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>('7d');

  const toggleExpand = (postId: string) => {
    setExpandedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-purple-300 border-t-purple-600" />
          <p className="mt-3 text-sm text-gray-500">Threadsデータを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Threadsデータがありません</p>
      </div>
    );
  }

  // データ取得
  const allPosts = data.threads?.data || [];
  const comments = data.threadsComments?.data || [];
  const allDailyMetrics = data.threadsDailyMetrics?.data || [];
  const allDailyPostStats = data.threadsDailyPostStats?.data || [];
  const latestMetrics = data.threadsDailyMetrics?.latest;
  const followersCount = latestMetrics?.followers_count || 0;

  // 日付範囲でフィルタリング
  const dateRange = getDateRange(datePreset);

  const posts = allPosts.filter(p => isDateInRange(p.timestamp, dateRange));
  const dailyFollowerMetrics = allDailyMetrics.filter(d => isDateInRange(d.date, dateRange));
  const dailyPostStats = allDailyPostStats.filter(d => isDateInRange(d.date, dateRange));

  // 合計計算
  const totalPosts = dailyPostStats.reduce((sum, d) => sum + (d.post_count || 0), 0);
  const totalViews = dailyPostStats.reduce((sum, d) => sum + (d.total_views || 0), 0);
  const totalLikes = dailyPostStats.reduce((sum, d) => sum + (d.total_likes || 0), 0);
  const totalReplies = dailyPostStats.reduce((sum, d) => sum + (d.total_replies || 0), 0);

  // コメント紐付け
  const commentsByPostId = new Map<string, ThreadsComment[]>();
  comments.forEach((c) => {
    if (!commentsByPostId.has(c.parent_post_id)) commentsByPostId.set(c.parent_post_id, []);
    commentsByPostId.get(c.parent_post_id)!.push(c);
  });

  // サマリー
  const engagementRate = totalViews > 0 ? ((totalLikes + totalReplies) / totalViews * 100).toFixed(2) : '0.00';
  const followerGrowth = dailyFollowerMetrics.reduce((sum, d) => sum + d.follower_delta, 0);

  // 日別メトリクス（テーブル+チャート用）
  const dailyMetrics = (() => {
    const merged = new Map<string, DailyMetric>();
    for (const metric of dailyFollowerMetrics) {
      merged.set(metric.date, {
        date: metric.date,
        followers_count: metric.followers_count || 0,
        follower_delta: metric.follower_delta || 0,
        total_views: 0,
        total_likes: 0,
        total_replies: 0,
        post_count: 0,
      });
    }
    for (const stat of dailyPostStats) {
      const existing = merged.get(stat.date) || {
        date: stat.date,
        followers_count: 0,
        follower_delta: 0,
        total_views: 0,
        total_likes: 0,
        total_replies: 0,
        post_count: 0,
      };
      merged.set(stat.date, {
        ...existing,
        total_views: stat.total_views || 0,
        total_likes: stat.total_likes || 0,
        total_replies: stat.total_replies || 0,
        post_count: stat.post_count || 0,
      });
    }
    const sorted = Array.from(merged.values())
      .filter((metric) => metric.date)
      .sort((a, b) => safeGetTime(a.date) - safeGetTime(b.date));
    let lastKnownFollowers = followersCount || 0;
    for (const metric of sorted) {
      if (metric.followers_count > 0) {
        lastKnownFollowers = metric.followers_count;
      } else {
        metric.followers_count = lastKnownFollowers;
      }
    }
    return sorted.reverse();
  })();

  // ソート
  const sortedPosts = [...posts].sort((a, b) => {
    if (sortBy === 'views') return (b.views || 0) - (a.views || 0);
    if (sortBy === 'likes') return (b.likes || 0) - (a.likes || 0);
    return safeGetTime(b.timestamp) - safeGetTime(a.timestamp);
  });

  // 遷移率計算
  const getTransitionRates = (post: ThreadsPost) => {
    const postComments = commentsByPostId.get(post.threads_id) || [];
    const postViews = post.views || 0;
    if (!postComments.length || postViews === 0) return { transitions: [] as { from: string; to: string; rate: number; views: number }[], overallRate: null as number | null };

    const byDepth = new Map<number, ThreadsComment>();
    for (const c of postComments) {
      const d = c.depth || 0;
      const existing = byDepth.get(d);
      if (!existing || (c.views || 0) > (existing.views || 0)) {
        byDepth.set(d, c);
      }
    }
    const depthKeys = [...byDepth.keys()].sort((a, b) => a - b);
    if (depthKeys.length === 0) return { transitions: [] as { from: string; to: string; rate: number; views: number }[], overallRate: null as number | null };

    const transitions: { from: string; to: string; rate: number; views: number }[] = [];
    const firstComment = byDepth.get(depthKeys[0])!;
    const firstViews = firstComment.views || 0;
    transitions.push({ from: 'メイン', to: 'コメント欄1', rate: postViews > 0 ? (firstViews / postViews) * 100 : 0, views: firstViews });

    for (let i = 1; i < depthKeys.length; i++) {
      const prevComment = byDepth.get(depthKeys[i - 1])!;
      const currComment = byDepth.get(depthKeys[i])!;
      const prevViews = prevComment.views || 0;
      const currViews = currComment.views || 0;
      if (prevViews > 0) {
        transitions.push({
          from: `コメント欄${i}`,
          to: `コメント欄${i + 1}`,
          rate: (currViews / prevViews) * 100,
          views: currViews,
        });
      }
    }
    const lastComment = byDepth.get(depthKeys[depthKeys.length - 1])!;
    const lastViews = lastComment.views || 0;
    const overallRate = postViews > 0 ? (lastViews / postViews) * 100 : null;
    return { transitions, overallRate };
  };

  const INITIAL_DISPLAY_COUNT = 10;
  const displayedPosts = showAllPosts ? sortedPosts : sortedPosts.slice(0, INITIAL_DISPLAY_COUNT);
  const hasMorePosts = sortedPosts.length > INITIAL_DISPLAY_COUNT;

  return (
    <div className="space-y-6">
      {/* 日付選択 */}
      <div className="flex items-center justify-end">
        <select
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value as DatePreset)}
          className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
        >
          {datePresetOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* アカウント + KPI */}
      <div className="grid lg:grid-cols-12 gap-4">
        {/* 左側：アカウント情報 */}
        <div className="lg:col-span-3">
          <div className="bg-white border border-gray-200 rounded-xl p-6 h-full flex flex-col justify-center shadow-sm">
            <div className="flex items-center mb-4">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 mr-4">
                {profilePicture ? (
                  <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-purple-500 to-emerald-400 text-white text-xl font-bold">
                    {username.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{username}</h2>
                <p className="text-xs text-gray-400">フォロワー数</p>
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-2xl font-semibold text-gray-900 mr-3">{followersCount.toLocaleString()}</span>
              <span className={`text-sm font-medium ${followerGrowth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {followerGrowth >= 0 ? '+' : ''}{followerGrowth}
              </span>
            </div>
          </div>
        </div>
        {/* 右側：KPI */}
        <div className="lg:col-span-9">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">パフォーマンス指標</h2>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">投稿数</dt>
                <dd className="mt-2 text-2xl font-semibold text-gray-900">{totalPosts}</dd>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">閲覧数</dt>
                <dd className="mt-2 text-2xl font-semibold text-gray-900">{totalViews.toLocaleString()}</dd>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">いいね</dt>
                <dd className="mt-2 text-2xl font-semibold text-gray-900">{totalLikes.toLocaleString()}</dd>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">エンゲージメント率</dt>
                <dd className="mt-2 text-2xl font-semibold text-gray-900">{engagementRate}%</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* 日別メトリクス */}
      {dailyMetrics.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">インプレッション & フォロワー推移</h2>
          <p className="mt-1 text-sm text-gray-500">日別のパフォーマンス</p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2">日付</th>
                  <th className="px-3 py-2 text-right">フォロワー</th>
                  <th className="px-3 py-2 text-right">増減</th>
                  <th className="px-3 py-2 text-right">投稿</th>
                  <th className="px-3 py-2 text-right">閲覧数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dailyMetrics.slice().reverse().map((m, idx) => (
                  <tr key={m.date || idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">{m.date || '-'}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{(m.followers_count || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={(m.follower_delta || 0) > 0 ? 'text-green-600' : (m.follower_delta || 0) < 0 ? 'text-red-600' : 'text-gray-500'}>
                        {(m.follower_delta || 0) > 0 ? `+${m.follower_delta}` : m.follower_delta || '0'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500">{m.post_count || 0}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{(m.total_views || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={[...dailyMetrics].reverse()} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(v) => v ? String(v).slice(5) : ''} />
                <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(v) => v != null ? v.toLocaleString() : ''} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12, fill: '#475569' }}
                  domain={[
                    (dataMin: number) => Math.floor(dataMin * 0.99),
                    (dataMax: number) => Math.ceil(dataMax * 1.01)
                  ]}
                />
                <Tooltip formatter={(value: number | null, name: string) => [value != null ? value.toLocaleString() : '-', name]} />
                <Legend />
                <Bar yAxisId="left" dataKey="total_views" name="閲覧数" fill="#6366f1" opacity={0.7} />
                <Line yAxisId="right" type="monotone" dataKey="followers_count" name="フォロワー" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* インサイト分析 */}
      <ThreadsInsights posts={posts} />

      {/* トップコンテンツ */}
      {displayedPosts.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <header className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">トップコンテンツ</h2>
              <p className="mt-1 text-sm text-gray-500">反応が高かった投稿 ({displayedPosts.length}/{sortedPosts.length}件)</p>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'views' | 'likes')}
              className="h-9 w-40 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700"
            >
              <option value="views">閲覧数</option>
              <option value="likes">いいね数</option>
              <option value="date">投稿日</option>
            </select>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {displayedPosts.map((post, idx) => {
              const isExpanded = expandedPosts.has(post.id);
              const { transitions, overallRate } = getTransitionRates(post);
              const isTop10 = idx < 10;
              const rank = idx + 1;
              const postComments = commentsByPostId.get(post.threads_id) || [];

              return (
                <div
                  key={post.id}
                  className={`rounded-lg border bg-white p-3 shadow-sm cursor-pointer ${
                    isTop10 ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200'
                  }`}
                  onClick={() => toggleExpand(post.id)}
                >
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center gap-2">
                      {isTop10 && (
                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                          rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                          rank === 2 ? 'bg-gray-300 text-gray-700' :
                          rank === 3 ? 'bg-amber-600 text-white' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {rank}
                        </span>
                      )}
                      <span>{safeFormatDate(post.timestamp)}</span>
                      {postComments.length > 0 && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                          コメント欄{postComments.length}つ
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span>閲覧 {(post.views || 0).toLocaleString()}</span>
                      <span>いいね {(post.likes || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {transitions.length > 0 && (
                    <div className="mt-2 rounded-md bg-gradient-to-r from-purple-50 to-indigo-50 p-2 border border-purple-100">
                      <div className="flex items-center gap-1 flex-wrap text-[10px]">
                        <div className="flex flex-col items-center">
                          <span className="text-gray-500">メイン</span>
                          <span className="font-bold text-gray-700">{(post.views || 0).toLocaleString()}</span>
                        </div>
                        {transitions.map((t, tIdx) => {
                          const isFirst = tIdx === 0;
                          const rate = t.rate || 0;
                          const colorClass = isFirst
                            ? rate >= 10 ? 'text-green-600' : 'text-red-500'
                            : rate >= 80 ? 'text-green-600' : rate >= 50 ? 'text-yellow-600' : 'text-red-500';
                          return (
                            <div key={tIdx} className="flex items-center gap-1">
                              <div className="flex flex-col items-center px-1">
                                <span className="text-gray-400">&rarr;</span>
                                <span className={`font-bold ${colorClass}`}>{rate.toFixed(1)}%</span>
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-gray-500">{t.to}</span>
                                <span className="font-bold text-gray-700">{(t.views || 0).toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {overallRate !== null && transitions.length > 1 && (
                        <div className="mt-1 pt-1 border-t border-purple-200 flex items-center gap-1 text-[10px]">
                          <span className="text-gray-500">全体遷移率:</span>
                          <span className={`font-bold ${overallRate >= 1 ? 'text-blue-600' : 'text-gray-500'}`}>{overallRate.toFixed(2)}%</span>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="mt-2 text-sm text-gray-900 whitespace-pre-wrap">
                    {isExpanded ? post.text : (post.text && post.text.length > 80 ? post.text.slice(0, 80) + '...' : post.text || '(テキストなし)')}
                  </p>

                  {post.permalink && (
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 text-xs text-purple-600 hover:underline inline-block"
                    >
                      Threadsで見る &rarr;
                    </a>
                  )}
                </div>
              );
            })}
          </div>
          {hasMorePosts && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => setShowAllPosts(!showAllPosts)}
                className="rounded-lg border border-gray-200 bg-white px-6 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50"
              >
                {showAllPosts ? '閉じる' : `続きを見る (残り${sortedPosts.length - INITIAL_DISPLAY_COUNT}件)`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
