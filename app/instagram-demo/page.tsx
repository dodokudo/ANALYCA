'use client';

import { useState, useEffect, useMemo } from 'react';
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

// ============ ダミーデータ ============

const DUMMY_USER = {
  username: 'demo_user',
  profile_picture_url: 'https://picsum.photos/200',
  followers_count: 12450,
  follower_growth: 234,
};

const DUMMY_DAILY_DATA = [
  { date: '12/10', followers: 12100, growth: 45, reach: 8500, profileViews: 420, webClicks: 85, storyCount: 2, storyViews: 4200 },
  { date: '12/11', followers: 12150, growth: 50, reach: 9200, profileViews: 480, webClicks: 92, storyCount: 3, storyViews: 4800 },
  { date: '12/12', followers: 12200, growth: 50, reach: 7800, profileViews: 390, webClicks: 78, storyCount: 1, storyViews: 3900 },
  { date: '12/13', followers: 12280, growth: 80, reach: 11500, profileViews: 620, webClicks: 125, storyCount: 4, storyViews: 5500 },
  { date: '12/14', followers: 12350, growth: 70, reach: 10200, profileViews: 550, webClicks: 110, storyCount: 2, storyViews: 5100 },
  { date: '12/15', followers: 12400, growth: 50, reach: 8900, profileViews: 445, webClicks: 89, storyCount: 3, storyViews: 4500 },
  { date: '12/16', followers: 12450, growth: 50, reach: 9500, profileViews: 475, webClicks: 95, storyCount: 2, storyViews: 4600 },
];

const DUMMY_REELS = [
  { id: 1, thumbnail: 'https://picsum.photos/400/711?random=1', date: '2024/12/14', views: 45200, likes: 1250, comments: 89, saves: 320 },
  { id: 2, thumbnail: 'https://picsum.photos/400/711?random=2', date: '2024/12/12', views: 38500, likes: 980, comments: 72, saves: 245 },
  { id: 3, thumbnail: 'https://picsum.photos/400/711?random=3', date: '2024/12/10', views: 32100, likes: 850, comments: 65, saves: 198 },
  { id: 4, thumbnail: 'https://picsum.photos/400/711?random=4', date: '2024/12/08', views: 28700, likes: 720, comments: 54, saves: 165 },
  { id: 5, thumbnail: 'https://picsum.photos/400/711?random=5', date: '2024/12/06', views: 25300, likes: 650, comments: 48, saves: 142 },
];

const DUMMY_STORIES = [
  { id: 1, thumbnail: 'https://picsum.photos/400/711?random=6', date: '2024/12/16', views: 5200, reach: 4800, replies: 12, followers: 12450 },
  { id: 2, thumbnail: 'https://picsum.photos/400/711?random=7', date: '2024/12/15', views: 4800, reach: 4500, replies: 8, followers: 12400 },
  { id: 3, thumbnail: 'https://picsum.photos/400/711?random=8', date: '2024/12/14', views: 5500, reach: 5100, replies: 15, followers: 12350 },
  { id: 4, thumbnail: 'https://picsum.photos/400/711?random=9', date: '2024/12/13', views: 4200, reach: 3900, replies: 6, followers: 12280 },
  { id: 5, thumbnail: 'https://picsum.photos/400/711?random=10', date: '2024/12/12', views: 4600, reach: 4300, replies: 9, followers: 12200 },
];

const DUMMY_REEL_DAILY = [
  { date: '12/10', totalViews: 32100, totalLikes: 850, followerGrowth: 45 },
  { date: '12/11', totalViews: 0, totalLikes: 0, followerGrowth: 50 },
  { date: '12/12', totalViews: 38500, totalLikes: 980, followerGrowth: 50 },
  { date: '12/13', totalViews: 0, totalLikes: 0, followerGrowth: 80 },
  { date: '12/14', totalViews: 45200, totalLikes: 1250, followerGrowth: 70 },
  { date: '12/15', totalViews: 0, totalLikes: 0, followerGrowth: 50 },
  { date: '12/16', totalViews: 0, totalLikes: 0, followerGrowth: 50 },
];

const DUMMY_STORY_DAILY = [
  { date: '12/10', totalViews: 4200, viewRate: 34.7, followers: 12100 },
  { date: '12/11', totalViews: 4800, viewRate: 39.5, followers: 12150 },
  { date: '12/12', totalViews: 3900, viewRate: 32.0, followers: 12200 },
  { date: '12/13', totalViews: 5500, viewRate: 44.8, followers: 12280 },
  { date: '12/14', totalViews: 5100, viewRate: 41.3, followers: 12350 },
  { date: '12/15', totalViews: 4500, viewRate: 36.3, followers: 12400 },
  { date: '12/16', totalViews: 4600, viewRate: 36.9, followers: 12450 },
];

// サマリー計算
const calculateSummary = () => {
  const totalReach = DUMMY_DAILY_DATA.reduce((sum, d) => sum + d.reach, 0);
  const totalProfileViews = DUMMY_DAILY_DATA.reduce((sum, d) => sum + d.profileViews, 0);
  const totalWebClicks = DUMMY_DAILY_DATA.reduce((sum, d) => sum + d.webClicks, 0);
  const totalGrowth = DUMMY_DAILY_DATA.reduce((sum, d) => sum + d.growth, 0);

  return {
    currentFollowers: DUMMY_USER.followers_count,
    followerGrowth: totalGrowth,
    latestReach: totalReach,
    latestProfileViews: totalProfileViews,
    latestWebsiteClicks: totalWebClicks,
    totalReels: DUMMY_REELS.length,
    totalStories: DUMMY_STORIES.length,
  };
};

type TabKey = 'dashboard' | 'reels' | 'stories' | 'daily';

const tabItems: { value: TabKey; label: string }[] = [
  { value: 'dashboard', label: '概要' },
  { value: 'reels', label: 'リール' },
  { value: 'stories', label: 'ストーリー' },
  { value: 'daily', label: 'デイリー' },
];

const presetLabels: Record<string, string> = {
  'yesterday': '昨日',
  'this-week': '今週',
  'last-week': '先週',
  'this-month': '今月',
  'last-month': '先月',
};

export default function InstagramDemoDashboard() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [mounted, setMounted] = useState(false);
  const [datePreset, setDatePreset] = useState('this-week');
  const [reelSortBy, setReelSortBy] = useState('views');
  const [storySortBy, setStorySortBy] = useState('views');

  useEffect(() => {
    setMounted(true);
  }, []);

  const summary = useMemo(() => calculateSummary(), []);

  const sortedReels = useMemo(() => {
    return [...DUMMY_REELS].sort((a, b) => {
      if (reelSortBy === 'date') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (reelSortBy === 'views') return b.views - a.views;
      if (reelSortBy === 'likes') return b.likes - a.likes;
      if (reelSortBy === 'saves') return b.saves - a.saves;
      return 0;
    });
  }, [reelSortBy]);

  const sortedStories = useMemo(() => {
    return [...DUMMY_STORIES].sort((a, b) => {
      if (storySortBy === 'date') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (storySortBy === 'views') return b.views - a.views;
      if (storySortBy === 'viewRate') return (b.views / b.followers) - (a.views / a.followers);
      return 0;
    });
  }, [storySortBy]);

  const enrichedDailyData = useMemo(() => {
    return DUMMY_DAILY_DATA.map((row) => ({
      ...row,
      followRate: row.reach > 0 ? ((row.growth / row.reach) * 100).toFixed(2) : '0.00',
      storyViewRate: row.followers > 0 ? ((row.storyViews / row.followers) * 100).toFixed(1) : '0.0',
    }));
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[color:var(--background)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--color-accent)]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      {/* メインコンテンツ */}
      <div className="section-stack mx-auto max-w-6xl px-4 py-6 pb-24 lg:pb-12">
        {/* ヘッダー */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          {/* タブ */}
          <div className="flex flex-wrap items-center gap-2">
            {tabItems.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`h-9 rounded-[var(--radius-sm)] px-3 text-sm font-medium transition-colors ${
                  activeTab === tab.value
                    ? 'bg-[color:var(--color-text-primary)] text-white'
                    : 'border border-[color:var(--color-border)] bg-white text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 日付選択 */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value)}
              className="h-9 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
            >
              <option value="yesterday">昨日</option>
              <option value="this-week">今週</option>
              <option value="last-week">先週</option>
              <option value="this-month">今月</option>
              <option value="last-month">先月</option>
            </select>
            <span className="text-xs text-[color:var(--color-text-muted)]">{presetLabels[datePreset]}</span>
          </div>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <>
            {/* アカウント情報 + ファネル分析 */}
            <div className="grid lg:grid-cols-12 gap-4">
              {/* アカウント情報 */}
              <div className="lg:col-span-3">
                <div className="card p-6 h-full flex flex-col justify-center">
                  <div className="flex items-center mb-4">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-[color:var(--color-surface-muted)] mr-4">
                      <img
                        src={DUMMY_USER.profile_picture_url}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">{DUMMY_USER.username}</h2>
                      <p className="text-xs text-[color:var(--color-text-muted)]">現在のフォロワー数</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="text-2xl font-semibold text-[color:var(--color-text-primary)] mr-3">{summary.currentFollowers.toLocaleString()}</span>
                    <span className="text-sm font-medium text-emerald-500">
                      +{summary.followerGrowth.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* ファネル分析 */}
              <div className="lg:col-span-9">
                <div className="card p-6">
                  <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)] mb-6">ファネル分析</h2>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-medium uppercase tracking-[0.08em] text-[color:var(--color-text-secondary)] mb-2">リーチ</span>
                      <span className="text-xl font-semibold text-[color:var(--color-text-primary)]">{summary.latestReach.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col items-center mx-3">
                      <div className="text-lg text-emerald-500">→</div>
                      <span className="text-xs font-medium text-emerald-500">{((summary.latestProfileViews / summary.latestReach) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-medium uppercase tracking-[0.08em] text-[color:var(--color-text-secondary)] mb-2">プロフ表示</span>
                      <span className="text-xl font-semibold text-[color:var(--color-text-primary)]">{summary.latestProfileViews.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col items-center mx-3">
                      <div className="text-lg text-emerald-500">→</div>
                      <span className="text-xs font-medium text-emerald-500">{((summary.latestWebsiteClicks / summary.latestProfileViews) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-medium uppercase tracking-[0.08em] text-[color:var(--color-text-secondary)] mb-2">リンククリック</span>
                      <span className="text-xl font-semibold text-[color:var(--color-text-primary)]">{summary.latestWebsiteClicks.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col items-center mx-3">
                      <div className="text-lg text-emerald-500">→</div>
                      <span className="text-xs font-medium text-emerald-500">{((summary.followerGrowth / summary.latestWebsiteClicks) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-medium uppercase tracking-[0.08em] text-[color:var(--color-text-secondary)] mb-2">フォロワー増加</span>
                      <span className="text-xl font-semibold text-[color:var(--color-text-primary)]">{summary.followerGrowth.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* パフォーマンス推移グラフ */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-[color:var(--color-text-primary)] mb-4">パフォーマンス推移</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={DUMMY_DAILY_DATA} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(v) => v.toLocaleString()} domain={['dataMin - 50', 'dataMax + 50']} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <Tooltip formatter={(value: number, name: string) => [value.toLocaleString(), name]} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="followers" name="フォロワー数" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                    <Bar yAxisId="right" dataKey="growth" name="フォロワー増加数" fill="#8B5CF6" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top リール */}
            <div className="card p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-[color:var(--color-text-primary)]">リールTOP5</h3>
                  <p className="text-xs text-[color:var(--color-text-muted)]">期間内の上位コンテンツ</p>
                </div>
                <button
                  onClick={() => setActiveTab('reels')}
                  className="h-9 px-3 text-sm font-medium rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)]"
                >
                  詳細
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-1">
                {sortedReels.slice(0, 5).map((reel) => (
                  <div
                    key={reel.id}
                    className="flex min-w-[180px] flex-shrink-0 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white shadow-sm"
                  >
                    <div className="relative aspect-[9/16] w-full bg-[color:var(--color-surface-muted)]">
                      <img src={reel.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                    </div>
                    <div className="flex flex-col gap-2 p-3">
                      <p className="text-xs text-[color:var(--color-text-muted)]">{reel.date}</p>
                      <dl className="space-y-1 text-sm text-[color:var(--color-text-secondary)]">
                        <div className="flex items-center justify-between">
                          <dt className="font-medium text-[color:var(--color-text-muted)]">再生数</dt>
                          <dd className="font-semibold text-[color:var(--color-text-primary)]">{reel.views.toLocaleString()}</dd>
                        </div>
                        <div className="flex items-center justify-between">
                          <dt className="font-medium text-[color:var(--color-text-muted)]">いいね</dt>
                          <dd className="font-semibold text-[color:var(--color-text-primary)]">{reel.likes.toLocaleString()}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top ストーリー */}
            <div className="card p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-[color:var(--color-text-primary)]">ストーリーTOP5</h3>
                  <p className="text-xs text-[color:var(--color-text-muted)]">期間内の上位コンテンツ</p>
                </div>
                <button
                  onClick={() => setActiveTab('stories')}
                  className="h-9 px-3 text-sm font-medium rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)]"
                >
                  詳細
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-1">
                {sortedStories.slice(0, 5).map((story) => {
                  const viewRate = ((story.views / story.followers) * 100).toFixed(1);
                  return (
                    <div
                      key={story.id}
                      className="flex min-w-[180px] flex-shrink-0 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white shadow-sm"
                    >
                      <div className="relative aspect-[9/16] w-full bg-[color:var(--color-surface-muted)]">
                        <img src={story.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                      </div>
                      <div className="flex flex-col gap-2 p-3">
                        <p className="text-xs text-[color:var(--color-text-muted)]">{story.date}</p>
                        <dl className="space-y-1 text-sm text-[color:var(--color-text-secondary)]">
                          <div className="flex items-center justify-between">
                            <dt className="font-medium text-[color:var(--color-text-muted)]">閲覧数</dt>
                            <dd className="font-semibold text-[color:var(--color-text-primary)]">{story.views.toLocaleString()}</dd>
                          </div>
                          <div className="flex items-center justify-between">
                            <dt className="font-medium text-[color:var(--color-text-muted)]">閲覧率</dt>
                            <dd className="font-semibold text-[color:var(--color-text-primary)]">{viewRate}%</dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Reels Tab */}
        {activeTab === 'reels' && (
          <>
            {/* リール パフォーマンス分析グラフ */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-[color:var(--color-text-primary)] mb-4">リール パフォーマンス分析</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={DUMMY_REEL_DAILY} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(v) => v.toLocaleString()} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <Tooltip formatter={(value: number, name: string) => [value.toLocaleString(), name]} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="totalViews" name="総再生数" stroke="#E11D48" strokeWidth={2} dot={{ r: 3 }} />
                    <Bar yAxisId="right" dataKey="followerGrowth" name="フォロワー増加数" fill="#10B981" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* リール一覧 */}
            <div className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">リール一覧</h2>
                  <p className="text-xs text-[color:var(--color-text-muted)]">表示件数 {sortedReels.length}</p>
                </div>
                <select
                  value={reelSortBy}
                  onChange={(e) => setReelSortBy(e.target.value)}
                  className="h-9 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
                >
                  <option value="date">日付</option>
                  <option value="views">再生数</option>
                  <option value="likes">いいね</option>
                  <option value="saves">保存</option>
                </select>
              </div>
              <div className="space-y-4">
                {sortedReels.map((reel) => (
                  <div key={reel.id} className="flex gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white p-4 shadow-sm">
                    <div className="relative w-[90px] flex-shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)]">
                      <div className="aspect-[9/16]">
                        <img src={reel.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-3">
                      <p className="text-xs text-[color:var(--color-text-muted)]">{reel.date}</p>
                      <dl className="grid grid-cols-2 gap-y-2 text-sm text-[color:var(--color-text-secondary)] sm:grid-cols-3">
                        <div>
                          <dt className="text-[color:var(--color-text-muted)]">再生数</dt>
                          <dd className="font-semibold text-[color:var(--color-text-primary)]">{reel.views.toLocaleString()}</dd>
                        </div>
                        <div>
                          <dt className="text-[color:var(--color-text-muted)]">いいね</dt>
                          <dd className="font-semibold text-[color:var(--color-text-primary)]">{reel.likes.toLocaleString()}</dd>
                        </div>
                        <div>
                          <dt className="text-[color:var(--color-text-muted)]">コメント</dt>
                          <dd className="font-semibold text-[color:var(--color-text-primary)]">{reel.comments.toLocaleString()}</dd>
                        </div>
                        <div>
                          <dt className="text-[color:var(--color-text-muted)]">保存</dt>
                          <dd className="font-semibold text-[color:var(--color-text-primary)]">{reel.saves.toLocaleString()}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Stories Tab */}
        {activeTab === 'stories' && (
          <>
            {/* ストーリー パフォーマンス分析グラフ */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-[color:var(--color-text-primary)] mb-4">ストーリー パフォーマンス分析</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={DUMMY_STORY_DAILY} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(v) => v.toLocaleString()} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#6B7280' }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(value: number, name: string) => {
                      if (name === '閲覧率') return [`${value.toFixed(1)}%`, name];
                      return [value.toLocaleString(), name];
                    }} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="totalViews" name="閲覧数" fill="#3B82F6" />
                    <Line yAxisId="right" type="monotone" dataKey="viewRate" name="閲覧率" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ストーリー一覧 */}
            <div className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">ストーリー一覧</h2>
                  <p className="text-xs text-[color:var(--color-text-muted)]">表示件数 {sortedStories.length}</p>
                </div>
                <select
                  value={storySortBy}
                  onChange={(e) => setStorySortBy(e.target.value)}
                  className="h-9 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
                >
                  <option value="date">日付</option>
                  <option value="views">閲覧数</option>
                  <option value="viewRate">閲覧率</option>
                </select>
              </div>
              <div className="space-y-4">
                {sortedStories.map((story) => {
                  const viewRate = ((story.views / story.followers) * 100).toFixed(1);
                  return (
                    <div key={story.id} className="flex gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white p-4 shadow-sm">
                      <div className="relative w-[90px] flex-shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)]">
                        <div className="aspect-[9/16]">
                          <img src={story.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
                        </div>
                      </div>
                      <div className="flex-1 space-y-3">
                        <p className="text-xs text-[color:var(--color-text-muted)]">{story.date}</p>
                        <dl className="grid grid-cols-2 gap-y-2 text-sm text-[color:var(--color-text-secondary)] sm:grid-cols-3">
                          <div>
                            <dt className="text-[color:var(--color-text-muted)]">閲覧数</dt>
                            <dd className="font-semibold text-[color:var(--color-text-primary)]">{story.views.toLocaleString()}</dd>
                          </div>
                          <div>
                            <dt className="text-[color:var(--color-text-muted)]">閲覧率</dt>
                            <dd className="font-semibold text-[color:var(--color-text-primary)]">{viewRate}%</dd>
                          </div>
                          <div>
                            <dt className="text-[color:var(--color-text-muted)]">リーチ</dt>
                            <dd className="font-semibold text-[color:var(--color-text-primary)]">{story.reach.toLocaleString()}</dd>
                          </div>
                          <div>
                            <dt className="text-[color:var(--color-text-muted)]">返信</dt>
                            <dd className="font-semibold text-[color:var(--color-text-primary)]">{story.replies.toLocaleString()}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Daily Tab */}
        {activeTab === 'daily' && (
          <>
            {/* デイリーグラフ */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)] mb-4">デイリー推移</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={DUMMY_DAILY_DATA} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(v) => v.toLocaleString()} />
                    <Tooltip formatter={(value: number, name: string) => [value.toLocaleString(), name]} />
                    <Legend />
                    <Bar dataKey="reach" name="リーチ" fill="#10B981" />
                    <Bar dataKey="profileViews" name="プロフ表示" fill="#3B82F6" />
                    <Bar dataKey="webClicks" name="リンククリック" fill="#6366F1" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* デイリーテーブル */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)] mb-4">デイリーデータ</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--color-border)] text-left">
                      <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] whitespace-nowrap">日付</th>
                      <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right whitespace-nowrap">フォロワー</th>
                      <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right whitespace-nowrap">増加</th>
                      <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right whitespace-nowrap">フォロー率</th>
                      <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right whitespace-nowrap">リーチ</th>
                      <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right whitespace-nowrap">プロフ表示</th>
                      <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right whitespace-nowrap">リンククリック</th>
                      <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right whitespace-nowrap">ST投稿数</th>
                      <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right whitespace-nowrap">ST閲覧数</th>
                      <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right whitespace-nowrap">ST閲覧率</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--color-border)]">
                    {enrichedDailyData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-[color:var(--color-surface-muted)]">
                        <td className="px-3 py-3 text-[color:var(--color-text-primary)] whitespace-nowrap">{row.date}</td>
                        <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right whitespace-nowrap">{row.followers.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <span className="text-emerald-600">+{row.growth}</span>
                        </td>
                        <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right whitespace-nowrap">{row.followRate}%</td>
                        <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right whitespace-nowrap">{row.reach.toLocaleString()}</td>
                        <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right whitespace-nowrap">{row.profileViews.toLocaleString()}</td>
                        <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right whitespace-nowrap">{row.webClicks.toLocaleString()}</td>
                        <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right whitespace-nowrap">{row.storyCount}</td>
                        <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right whitespace-nowrap">{row.storyViews.toLocaleString()}</td>
                        <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right whitespace-nowrap">{row.storyViewRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[color:var(--color-border)] shadow-lg z-50 safe-area-bottom">
        <div className="flex justify-around py-2">
          {tabItems.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex flex-col items-center px-4 py-1 ${
                activeTab === tab.value ? 'text-[color:var(--color-accent)]' : 'text-[color:var(--color-text-muted)]'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {tab.value === 'dashboard' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />}
                {tab.value === 'reels' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />}
                {tab.value === 'stories' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />}
                {tab.value === 'daily' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />}
              </svg>
              <span className="text-xs mt-1">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
