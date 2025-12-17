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
  ResponsiveContainer,
  LineChart,
} from 'recharts';

// ============ チャンネル定義 ============
type Channel = 'instagram' | 'threads' | 'line';

const channelItems: { value: Channel; label: string; icon: string }[] = [
  { value: 'instagram', label: 'Instagram', icon: '📷' },
  { value: 'threads', label: 'Threads', icon: '🧵' },
  { value: 'line', label: 'LINE', icon: '💬' },
];

// ============ Instagram ダミーデータ ============
const DUMMY_IG_USER = {
  username: 'demo_account',
  profile_picture_url: 'https://picsum.photos/200',
  followers_count: 12450,
  follower_growth: 234,
};

const DUMMY_IG_DAILY_DATA = [
  { date: '12/10', followers: 12100, growth: 45, reach: 8500, profileViews: 420, webClicks: 85, storyCount: 2, storyViews: 4200 },
  { date: '12/11', followers: 12150, growth: 50, reach: 9200, profileViews: 480, webClicks: 92, storyCount: 3, storyViews: 4800 },
  { date: '12/12', followers: 12200, growth: 50, reach: 7800, profileViews: 390, webClicks: 78, storyCount: 1, storyViews: 3900 },
  { date: '12/13', followers: 12280, growth: 80, reach: 11500, profileViews: 620, webClicks: 125, storyCount: 4, storyViews: 5500 },
  { date: '12/14', followers: 12350, growth: 70, reach: 10200, profileViews: 550, webClicks: 110, storyCount: 2, storyViews: 5100 },
  { date: '12/15', followers: 12400, growth: 50, reach: 8900, profileViews: 445, webClicks: 89, storyCount: 3, storyViews: 4500 },
  { date: '12/16', followers: 12450, growth: 50, reach: 9500, profileViews: 475, webClicks: 95, storyCount: 2, storyViews: 4600 },
];

const DUMMY_IG_REELS = [
  { id: 1, thumbnail: 'https://picsum.photos/400/711?random=1', date: '2024/12/14', views: 45200, likes: 1250, comments: 89, saves: 320 },
  { id: 2, thumbnail: 'https://picsum.photos/400/711?random=2', date: '2024/12/12', views: 38500, likes: 980, comments: 72, saves: 245 },
  { id: 3, thumbnail: 'https://picsum.photos/400/711?random=3', date: '2024/12/10', views: 32100, likes: 850, comments: 65, saves: 198 },
  { id: 4, thumbnail: 'https://picsum.photos/400/711?random=4', date: '2024/12/08', views: 28700, likes: 720, comments: 54, saves: 165 },
  { id: 5, thumbnail: 'https://picsum.photos/400/711?random=5', date: '2024/12/06', views: 25300, likes: 650, comments: 48, saves: 142 },
];

const DUMMY_IG_STORIES = [
  { id: 1, thumbnail: 'https://picsum.photos/400/711?random=6', date: '2024/12/16', views: 5200, reach: 4800, replies: 12, followers: 12450 },
  { id: 2, thumbnail: 'https://picsum.photos/400/711?random=7', date: '2024/12/15', views: 4800, reach: 4500, replies: 8, followers: 12400 },
  { id: 3, thumbnail: 'https://picsum.photos/400/711?random=8', date: '2024/12/14', views: 5500, reach: 5100, replies: 15, followers: 12350 },
  { id: 4, thumbnail: 'https://picsum.photos/400/711?random=9', date: '2024/12/13', views: 4200, reach: 3900, replies: 6, followers: 12280 },
  { id: 5, thumbnail: 'https://picsum.photos/400/711?random=10', date: '2024/12/12', views: 4600, reach: 4300, replies: 9, followers: 12200 },
];

// ============ Threads ダミーデータ ============
const DUMMY_THREADS_USER = {
  username: 'demo_account',
  profile_picture_url: 'https://picsum.photos/200',
  followers_count: 8320,
};

const DUMMY_THREADS_DAILY = [
  { date: '2024-12-10', followers_count: 8050, follower_delta: 35, total_views: 24500, post_count: 2 },
  { date: '2024-12-11', followers_count: 8100, follower_delta: 50, total_views: 28200, post_count: 3 },
  { date: '2024-12-12', followers_count: 8140, follower_delta: 40, total_views: 21800, post_count: 1 },
  { date: '2024-12-13', followers_count: 8200, follower_delta: 60, total_views: 35600, post_count: 4 },
  { date: '2024-12-14', followers_count: 8250, follower_delta: 50, total_views: 31200, post_count: 2 },
  { date: '2024-12-15', followers_count: 8290, follower_delta: 40, total_views: 26800, post_count: 2 },
  { date: '2024-12-16', followers_count: 8320, follower_delta: 30, total_views: 29400, post_count: 3 },
];

const DUMMY_THREADS_POSTS = [
  {
    id: '1',
    text: '今日は新しいプロジェクトの発表がありました！とても興奮しています。皆さんの反応が楽しみです。',
    timestamp: '2024-12-16T10:30:00Z',
    permalink: 'https://threads.net/@demo_account/post/1',
    views: 12500,
    likes: 420,
    replies: 35,
    comments: [
      { id: 'c1', text: '詳細はこちらのリンクから確認できます。ぜひチェックしてください！', views: 8200, depth: 0 },
      { id: 'c2', text: '質問があればコメントで教えてくださいね。', views: 5800, depth: 1 },
    ],
  },
  {
    id: '2',
    text: 'マーケティングの基本について解説します。まず大切なのは、ターゲット顧客を明確にすることです。',
    timestamp: '2024-12-15T14:20:00Z',
    permalink: 'https://threads.net/@demo_account/post/2',
    views: 18200,
    likes: 680,
    replies: 52,
    comments: [
      { id: 'c3', text: '次に、顧客のニーズを深く理解することが重要です。', views: 12400, depth: 0 },
      { id: 'c4', text: '最後に、価値提案を明確に伝えましょう。', views: 9100, depth: 1 },
      { id: 'c5', text: 'まとめ：ターゲット→ニーズ理解→価値提案の3ステップ！', views: 6800, depth: 2 },
    ],
  },
  {
    id: '3',
    text: '朝のルーティンを変えてから、生産性が2倍になりました。その秘訣をシェアします。',
    timestamp: '2024-12-14T08:00:00Z',
    permalink: 'https://threads.net/@demo_account/post/3',
    views: 22400,
    likes: 890,
    replies: 78,
    comments: [],
  },
  {
    id: '4',
    text: 'SNS運用で大切なことは継続性です。毎日少しずつでも発信を続けることが成功への鍵。',
    timestamp: '2024-12-13T16:45:00Z',
    permalink: 'https://threads.net/@demo_account/post/4',
    views: 15600,
    likes: 520,
    replies: 41,
    comments: [
      { id: 'c6', text: '具体的には、週3回以上の投稿を目標にしましょう。', views: 10200, depth: 0 },
    ],
  },
  {
    id: '5',
    text: '今週のおすすめ本を紹介します。ビジネスパーソン必読の一冊です。',
    timestamp: '2024-12-12T12:00:00Z',
    permalink: 'https://threads.net/@demo_account/post/5',
    views: 9800,
    likes: 310,
    replies: 24,
    comments: [],
  },
];

// ============ LINE ダミーデータ ============
const DUMMY_LINE_DATA = {
  friends_count: 2450,
  friends_growth: 89,
  blocked_count: 12,
  target_reach: 2438,
};

const DUMMY_LINE_DAILY = [
  { date: '12/10', friends: 2320, growth: 12, blocked: 2, messages_sent: 1, open_rate: 68.5 },
  { date: '12/11', friends: 2340, growth: 20, blocked: 1, messages_sent: 0, open_rate: 0 },
  { date: '12/12', friends: 2360, growth: 20, blocked: 2, messages_sent: 1, open_rate: 72.3 },
  { date: '12/13', friends: 2390, growth: 30, blocked: 3, messages_sent: 2, open_rate: 65.8 },
  { date: '12/14', friends: 2410, growth: 20, blocked: 1, messages_sent: 1, open_rate: 70.2 },
  { date: '12/15', friends: 2435, growth: 25, blocked: 2, messages_sent: 0, open_rate: 0 },
  { date: '12/16', friends: 2450, growth: 15, blocked: 1, messages_sent: 1, open_rate: 74.1 },
];

// ============ メインコンポーネント ============
export default function DemoPage() {
  const [activeChannel, setActiveChannel] = useState<Channel>('instagram');
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[color:var(--color-background)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--color-accent)]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--color-background)] flex">
      {/* サイドバー（PC） */}
      <aside className="hidden lg:flex lg:flex-col lg:w-56 bg-[color:var(--color-surface)] border-r border-[color:var(--color-border)] fixed h-full z-40">
        {/* ANALYCAロゴ */}
        <div className="p-4 border-b border-[color:var(--color-border)]">
          <h1 className="text-xl font-bold text-[color:var(--color-text-primary)]">ANALYCA</h1>
          <p className="text-xs text-[color:var(--color-text-muted)] mt-1">Demo Account</p>
        </div>

        {/* チャンネル切替 */}
        <nav className="flex-1 p-3 space-y-1">
          {channelItems.map((channel) => (
            <button
              key={channel.value}
              onClick={() => setActiveChannel(channel.value)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors ${
                activeChannel === channel.value
                  ? 'bg-[color:var(--color-accent)] text-white'
                  : 'text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)]'
              }`}
            >
              <span className="text-lg">{channel.icon}</span>
              {channel.label}
            </button>
          ))}
        </nav>

        {/* フッター */}
        <div className="p-4 border-t border-[color:var(--color-border)]">
          <p className="text-xs text-[color:var(--color-text-muted)]">デモモード</p>
        </div>
      </aside>

      {/* モバイルサイドバー */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-[color:var(--color-surface)] border-r border-[color:var(--color-border)]">
            <div className="p-4 border-b border-[color:var(--color-border)] flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-[color:var(--color-text-primary)]">ANALYCA</h1>
                <p className="text-xs text-[color:var(--color-text-muted)] mt-1">Demo Account</p>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-2 text-[color:var(--color-text-secondary)]">
                ✕
              </button>
            </div>
            <nav className="p-3 space-y-1">
              {channelItems.map((channel) => (
                <button
                  key={channel.value}
                  onClick={() => {
                    setActiveChannel(channel.value);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors ${
                    activeChannel === channel.value
                      ? 'bg-[color:var(--color-accent)] text-white'
                      : 'text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)]'
                  }`}
                >
                  <span className="text-lg">{channel.icon}</span>
                  {channel.label}
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* メインコンテンツ */}
      <main className="flex-1 lg:ml-56">
        {/* モバイルヘッダー */}
        <header className="lg:hidden sticky top-0 z-30 bg-[color:var(--color-surface)] border-b border-[color:var(--color-border)] px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-[var(--radius-sm)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)]"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-[color:var(--color-text-primary)]">ANALYCA</h1>
          <span className="text-xs text-[color:var(--color-text-muted)]">Demo</span>
        </header>

        {/* チャンネルコンテンツ */}
        <div className="p-4 lg:p-6">
          {activeChannel === 'instagram' && <InstagramDemo />}
          {activeChannel === 'threads' && <ThreadsDemo />}
          {activeChannel === 'line' && <LineDemo />}
        </div>
      </main>

      {/* モバイルボトムナビ */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[color:var(--color-surface)] border-t border-[color:var(--color-border)] safe-area-bottom z-40">
        <div className="flex justify-around py-2">
          {channelItems.map((channel) => (
            <button
              key={channel.value}
              onClick={() => setActiveChannel(channel.value)}
              className={`flex flex-col items-center px-4 py-1 ${
                activeChannel === channel.value
                  ? 'text-[color:var(--color-accent)]'
                  : 'text-[color:var(--color-text-muted)]'
              }`}
            >
              <span className="text-xl">{channel.icon}</span>
              <span className="text-xs mt-1">{channel.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

// ============ Instagram デモ ============
type IGTab = 'overview' | 'reels' | 'stories' | 'daily';

function InstagramDemo() {
  const [activeTab, setActiveTab] = useState<IGTab>('overview');
  const [reelSortBy, setReelSortBy] = useState('views');
  const [storySortBy, setStorySortBy] = useState('views');

  const summary = useMemo(() => {
    const totalReach = DUMMY_IG_DAILY_DATA.reduce((sum, d) => sum + d.reach, 0);
    const totalProfileViews = DUMMY_IG_DAILY_DATA.reduce((sum, d) => sum + d.profileViews, 0);
    const totalWebClicks = DUMMY_IG_DAILY_DATA.reduce((sum, d) => sum + d.webClicks, 0);
    const totalGrowth = DUMMY_IG_DAILY_DATA.reduce((sum, d) => sum + d.growth, 0);
    return { totalReach, totalProfileViews, totalWebClicks, totalGrowth };
  }, []);

  const sortedReels = useMemo(() => {
    return [...DUMMY_IG_REELS].sort((a, b) => {
      if (reelSortBy === 'date') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (reelSortBy === 'views') return b.views - a.views;
      if (reelSortBy === 'likes') return b.likes - a.likes;
      return 0;
    });
  }, [reelSortBy]);

  const sortedStories = useMemo(() => {
    return [...DUMMY_IG_STORIES].sort((a, b) => {
      if (storySortBy === 'date') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (storySortBy === 'views') return b.views - a.views;
      return 0;
    });
  }, [storySortBy]);

  const tabItems: { value: IGTab; label: string }[] = [
    { value: 'overview', label: '概要' },
    { value: 'reels', label: 'リール' },
    { value: 'stories', label: 'ストーリー' },
    { value: 'daily', label: 'デイリー' },
  ];

  return (
    <div className="section-stack pb-20 lg:pb-6">
      {/* タブ */}
      <div className="flex flex-wrap items-center gap-2">
        {tabItems.map((tab) => (
          <button
            key={tab.value}
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

      {/* 概要タブ */}
      {activeTab === 'overview' && (
        <>
          {/* アカウント + ファネル */}
          <div className="grid lg:grid-cols-12 gap-4">
            <div className="lg:col-span-3">
              <div className="ui-card p-6 h-full flex flex-col justify-center">
                <div className="flex items-center mb-4">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-[color:var(--color-surface-muted)] mr-4">
                    <img src={DUMMY_IG_USER.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">{DUMMY_IG_USER.username}</h2>
                    <p className="text-xs text-[color:var(--color-text-muted)]">フォロワー数</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <span className="text-2xl font-semibold text-[color:var(--color-text-primary)] mr-3">{DUMMY_IG_USER.followers_count.toLocaleString()}</span>
                  <span className="text-sm font-medium text-green-500">+{summary.totalGrowth}</span>
                </div>
              </div>
            </div>
            <div className="lg:col-span-9">
              <div className="ui-card p-6">
                <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)] mb-6">ファネル分析</h2>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">リーチ</span>
                    <span className="text-xl font-semibold text-[color:var(--color-text-primary)]">{summary.totalReach.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-green-500">→</span>
                    <span className="text-xs text-green-500">{((summary.totalProfileViews / summary.totalReach) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">プロフ表示</span>
                    <span className="text-xl font-semibold text-[color:var(--color-text-primary)]">{summary.totalProfileViews.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-green-500">→</span>
                    <span className="text-xs text-green-500">{((summary.totalWebClicks / summary.totalProfileViews) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">リンククリック</span>
                    <span className="text-xl font-semibold text-[color:var(--color-text-primary)]">{summary.totalWebClicks.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-green-500">→</span>
                    <span className="text-xs text-green-500">{((summary.totalGrowth / summary.totalWebClicks) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">フォロワー増加</span>
                    <span className="text-xl font-semibold text-[color:var(--color-text-primary)]">{summary.totalGrowth.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* グラフ */}
          <div className="ui-card p-6">
            <h3 className="text-lg font-semibold text-[color:var(--color-text-primary)] mb-4">パフォーマンス推移</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={DUMMY_IG_DAILY_DATA} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(v) => v.toLocaleString()} domain={['dataMin - 50', 'dataMax + 50']} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#6B7280' }} />
                  <Tooltip formatter={(value: number, name: string) => [value.toLocaleString(), name]} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="followers" name="フォロワー数" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                  <Bar yAxisId="right" dataKey="growth" name="増加数" fill="#8B5CF6" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* リールTOP5 */}
          <div className="ui-card p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="text-lg font-semibold text-[color:var(--color-text-primary)]">リールTOP5</h3>
              <button onClick={() => setActiveTab('reels')} className="h-9 px-3 text-sm font-medium rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)]">
                詳細
              </button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-1">
              {sortedReels.slice(0, 5).map((reel) => (
                <div key={reel.id} className="flex min-w-[160px] flex-shrink-0 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white shadow-sm">
                  <div className="relative aspect-[9/16] w-full bg-[color:var(--color-surface-muted)]">
                    <img src={reel.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-xs text-[color:var(--color-text-muted)]">{reel.date}</p>
                    <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">{reel.views.toLocaleString()} 再生</p>
                    <p className="text-xs text-[color:var(--color-text-secondary)]">{reel.likes.toLocaleString()} いいね</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* リールタブ */}
      {activeTab === 'reels' && (
        <div className="ui-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">リール一覧</h2>
            <select value={reelSortBy} onChange={(e) => setReelSortBy(e.target.value)} className="h-9 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-text-secondary)]">
              <option value="date">日付</option>
              <option value="views">再生数</option>
              <option value="likes">いいね</option>
            </select>
          </div>
          <div className="space-y-4">
            {sortedReels.map((reel) => (
              <div key={reel.id} className="flex gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white p-4 shadow-sm">
                <div className="w-[90px] flex-shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)]">
                  <div className="aspect-[9/16]">
                    <img src={reel.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-xs text-[color:var(--color-text-muted)]">{reel.date}</p>
                  <dl className="grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-4">
                    <div><dt className="text-[color:var(--color-text-muted)]">再生数</dt><dd className="font-semibold text-[color:var(--color-text-primary)]">{reel.views.toLocaleString()}</dd></div>
                    <div><dt className="text-[color:var(--color-text-muted)]">いいね</dt><dd className="font-semibold text-[color:var(--color-text-primary)]">{reel.likes.toLocaleString()}</dd></div>
                    <div><dt className="text-[color:var(--color-text-muted)]">コメント</dt><dd className="font-semibold text-[color:var(--color-text-primary)]">{reel.comments.toLocaleString()}</dd></div>
                    <div><dt className="text-[color:var(--color-text-muted)]">保存</dt><dd className="font-semibold text-[color:var(--color-text-primary)]">{reel.saves.toLocaleString()}</dd></div>
                  </dl>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ストーリータブ */}
      {activeTab === 'stories' && (
        <div className="ui-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">ストーリー一覧</h2>
            <select value={storySortBy} onChange={(e) => setStorySortBy(e.target.value)} className="h-9 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-text-secondary)]">
              <option value="date">日付</option>
              <option value="views">閲覧数</option>
            </select>
          </div>
          <div className="space-y-4">
            {sortedStories.map((story) => {
              const viewRate = ((story.views / story.followers) * 100).toFixed(1);
              return (
                <div key={story.id} className="flex gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white p-4 shadow-sm">
                  <div className="w-[90px] flex-shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)]">
                    <div className="aspect-[9/16]">
                      <img src={story.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-xs text-[color:var(--color-text-muted)]">{story.date}</p>
                    <dl className="grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-4">
                      <div><dt className="text-[color:var(--color-text-muted)]">閲覧数</dt><dd className="font-semibold text-[color:var(--color-text-primary)]">{story.views.toLocaleString()}</dd></div>
                      <div><dt className="text-[color:var(--color-text-muted)]">閲覧率</dt><dd className="font-semibold text-[color:var(--color-text-primary)]">{viewRate}%</dd></div>
                      <div><dt className="text-[color:var(--color-text-muted)]">リーチ</dt><dd className="font-semibold text-[color:var(--color-text-primary)]">{story.reach.toLocaleString()}</dd></div>
                      <div><dt className="text-[color:var(--color-text-muted)]">返信</dt><dd className="font-semibold text-[color:var(--color-text-primary)]">{story.replies}</dd></div>
                    </dl>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* デイリータブ */}
      {activeTab === 'daily' && (
        <>
          <div className="ui-card p-6">
            <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)] mb-4">デイリー推移</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={DUMMY_IG_DAILY_DATA} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
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
          <div className="ui-card p-6">
            <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)] mb-4">デイリーデータ</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--color-border)] text-left">
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)]">日付</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right">フォロワー</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right">増加</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right">リーチ</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right">プロフ表示</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right">クリック</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)]">
                  {DUMMY_IG_DAILY_DATA.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[color:var(--color-surface-muted)]">
                      <td className="px-3 py-3 text-[color:var(--color-text-primary)]">{row.date}</td>
                      <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right">{row.followers.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right"><span className="text-green-600">+{row.growth}</span></td>
                      <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right">{row.reach.toLocaleString()}</td>
                      <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right">{row.profileViews.toLocaleString()}</td>
                      <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right">{row.webClicks.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============ Threads デモ ============
function ThreadsDemo() {
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'date' | 'views' | 'likes'>('views');
  const [showAllPosts, setShowAllPosts] = useState(false);

  const toggleExpand = (postId: string) => {
    setExpandedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const sortedPosts = useMemo(() => {
    return [...DUMMY_THREADS_POSTS].sort((a, b) => {
      if (sortBy === 'views') return b.views - a.views;
      if (sortBy === 'likes') return b.likes - a.likes;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [sortBy]);

  const summary = useMemo(() => {
    const totalViews = DUMMY_THREADS_POSTS.reduce((sum, p) => sum + p.views, 0);
    const totalLikes = DUMMY_THREADS_POSTS.reduce((sum, p) => sum + p.likes, 0);
    const totalReplies = DUMMY_THREADS_POSTS.reduce((sum, p) => sum + p.replies, 0);
    const engagementRate = totalViews > 0 ? ((totalLikes + totalReplies) / totalViews * 100).toFixed(2) : '0.00';
    return { totalViews, totalLikes, totalReplies, engagementRate };
  }, []);

  const getTransitionRates = (post: typeof DUMMY_THREADS_POSTS[0]) => {
    if (!post.comments.length || post.views === 0) return { transitions: [], overallRate: null };
    const transitions: { from: string; to: string; rate: number; views: number }[] = [];
    const sorted = [...post.comments].sort((a, b) => a.depth - b.depth);

    if (sorted.length > 0) {
      transitions.push({ from: 'メイン', to: 'コメント欄1', rate: (sorted[0].views / post.views) * 100, views: sorted[0].views });
    }
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i - 1].views > 0) {
        transitions.push({
          from: `コメント欄${i}`,
          to: `コメント欄${i + 1}`,
          rate: (sorted[i].views / sorted[i - 1].views) * 100,
          views: sorted[i].views,
        });
      }
    }
    const last = sorted[sorted.length - 1];
    const overallRate = post.views > 0 ? (last.views / post.views) * 100 : null;
    return { transitions, overallRate };
  };

  const INITIAL_DISPLAY_COUNT = 10;
  const displayedPosts = showAllPosts ? sortedPosts : sortedPosts.slice(0, INITIAL_DISPLAY_COUNT);
  const hasMorePosts = sortedPosts.length > INITIAL_DISPLAY_COUNT;

  return (
    <div className="section-stack pb-20 lg:pb-6">
      {/* タブ（ホームのみ） */}
      <div className="flex flex-wrap items-center gap-2">
        <button className="h-9 rounded-[var(--radius-sm)] px-3 text-sm font-medium bg-[color:var(--color-text-primary)] text-white">
          ホーム
        </button>
      </div>

      {/* アカウントの概要 */}
      <div className="ui-card">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">アカウントの概要</h2>
            <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">投稿のパフォーマンス指標</p>
          </div>
        </header>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-5">
            <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wide">フォロワー</dt>
            <dd className="mt-4 text-[2rem] font-semibold leading-none text-[color:var(--color-text-primary)]">{DUMMY_THREADS_USER.followers_count.toLocaleString()}</dd>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-5">
            <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wide">投稿数</dt>
            <dd className="mt-4 text-[2rem] font-semibold leading-none text-[color:var(--color-text-primary)]">{DUMMY_THREADS_POSTS.length}</dd>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-5">
            <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wide">閲覧数</dt>
            <dd className="mt-4 text-[2rem] font-semibold leading-none text-[color:var(--color-text-primary)]">{summary.totalViews.toLocaleString()}</dd>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-5">
            <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wide">いいね</dt>
            <dd className="mt-4 text-[2rem] font-semibold leading-none text-[color:var(--color-text-primary)]">{summary.totalLikes.toLocaleString()}</dd>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-5">
            <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wide">エンゲージメント率</dt>
            <dd className="mt-4 text-[2rem] font-semibold leading-none text-[color:var(--color-text-primary)]">{summary.engagementRate}%</dd>
          </div>
        </dl>
      </div>

      {/* 日別メトリクス */}
      <div className="ui-card">
        <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">インプレッション & フォロワー推移</h2>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">日別のパフォーマンス</p>
        <div className="mt-4 overflow-x-auto rounded-[var(--radius-md)] border border-[color:var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b border-[color:var(--color-border)] text-left text-xs uppercase tracking-wide text-[color:var(--color-text-secondary)]">
                <th className="px-3 py-2">日付</th>
                <th className="px-3 py-2 text-right">フォロワー</th>
                <th className="px-3 py-2 text-right">増減</th>
                <th className="px-3 py-2 text-right">投稿</th>
                <th className="px-3 py-2 text-right">閲覧数</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {DUMMY_THREADS_DAILY.map((m) => (
                <tr key={m.date} className="hover:bg-[color:var(--color-surface-muted)]">
                  <td className="px-3 py-2 font-medium text-[color:var(--color-text-primary)]">{m.date}</td>
                  <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{m.followers_count.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={m.follower_delta > 0 ? 'text-green-600' : 'text-[color:var(--color-text-secondary)]'}>
                      {m.follower_delta > 0 ? `+${m.follower_delta}` : '0'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-[color:var(--color-text-secondary)]">{m.post_count}</td>
                  <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{m.total_views.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={DUMMY_THREADS_DAILY} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(v) => v.slice(5)} />
              <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(v) => v.toLocaleString()} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#475569' }} />
              <Tooltip formatter={(value: number, name: string) => [value.toLocaleString(), name]} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="followers_count" name="フォロワー" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="total_views" name="閲覧数" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* トップコンテンツ */}
      <div className="ui-card">
        <header className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">トップコンテンツ</h2>
            <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">反応が高かった投稿 ({displayedPosts.length}/{sortedPosts.length}件)</p>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'views' | 'likes')}
            className="h-9 w-40 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-text-secondary)]"
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

            return (
              <div
                key={post.id}
                className={`rounded-[var(--radius-md)] border bg-white p-3 shadow-[var(--shadow-soft)] cursor-pointer ${
                  isTop10 ? 'border-amber-300 bg-amber-50/30' : 'border-[color:var(--color-border)]'
                }`}
                onClick={() => toggleExpand(post.id)}
              >
                <div className="flex items-center justify-between text-xs text-[color:var(--color-text-muted)]">
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
                    <span>{new Date(post.timestamp).toLocaleDateString('ja-JP')}</span>
                    {post.comments.length > 0 && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                        コメント欄{post.comments.length}つ
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span>閲覧 {post.views.toLocaleString()}</span>
                    <span>いいね {post.likes.toLocaleString()}</span>
                  </div>
                </div>

                {transitions.length > 0 && (
                  <div className="mt-2 rounded-md bg-gradient-to-r from-purple-50 to-indigo-50 p-2 border border-purple-100">
                    <div className="flex items-center gap-1 flex-wrap text-[10px]">
                      <div className="flex flex-col items-center">
                        <span className="text-gray-500">メイン</span>
                        <span className="font-bold text-gray-700">{post.views.toLocaleString()}</span>
                      </div>
                      {transitions.map((t, tIdx) => {
                        const isFirst = tIdx === 0;
                        const colorClass = isFirst
                          ? t.rate >= 10 ? 'text-green-600' : 'text-red-500'
                          : t.rate >= 80 ? 'text-green-600' : t.rate >= 50 ? 'text-yellow-600' : 'text-red-500';
                        return (
                          <div key={tIdx} className="flex items-center gap-1">
                            <div className="flex flex-col items-center px-1">
                              <span className="text-gray-400">→</span>
                              <span className={`font-bold ${colorClass}`}>{t.rate.toFixed(1)}%</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-gray-500">{t.to}</span>
                              <span className="font-bold text-gray-700">{t.views.toLocaleString()}</span>
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

                <p className="mt-2 text-sm text-[color:var(--color-text-primary)] whitespace-pre-wrap">
                  {isExpanded ? post.text : (post.text.length > 80 ? post.text.slice(0, 80) + '…' : post.text)}
                </p>

                {post.permalink && (
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 text-xs text-[color:var(--color-accent)] hover:underline inline-block"
                  >
                    Threadsで見る →
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
              className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white px-6 py-2 text-sm font-medium text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-surface-muted)]"
            >
              {showAllPosts ? '閉じる' : `続きを見る (残り${sortedPosts.length - INITIAL_DISPLAY_COUNT}件)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ LINE デモ ============
function LineDemo() {
  return (
    <div className="section-stack pb-20 lg:pb-6">
      {/* タブ（ホームのみ） */}
      <div className="flex flex-wrap items-center gap-2">
        <button className="h-9 rounded-[var(--radius-sm)] px-3 text-sm font-medium bg-[color:var(--color-text-primary)] text-white">
          ホーム
        </button>
      </div>

      {/* アカウントの概要 */}
      <div className="ui-card">
        <header>
          <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">アカウントの概要</h2>
          <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">LINE公式アカウントの指標</p>
        </header>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-5">
            <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wide">友だち数</dt>
            <dd className="mt-4 text-[2rem] font-semibold leading-none text-[color:var(--color-text-primary)]">{DUMMY_LINE_DATA.friends_count.toLocaleString()}</dd>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-5">
            <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wide">今週の増加</dt>
            <dd className="mt-4 text-[2rem] font-semibold leading-none text-green-600">+{DUMMY_LINE_DATA.friends_growth}</dd>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-5">
            <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wide">ブロック数</dt>
            <dd className="mt-4 text-[2rem] font-semibold leading-none text-[color:var(--color-text-primary)]">{DUMMY_LINE_DATA.blocked_count}</dd>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-5">
            <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wide">ターゲットリーチ</dt>
            <dd className="mt-4 text-[2rem] font-semibold leading-none text-[color:var(--color-text-primary)]">{DUMMY_LINE_DATA.target_reach.toLocaleString()}</dd>
          </div>
        </dl>
      </div>

      {/* 日別メトリクス */}
      <div className="ui-card">
        <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">友だち数 & 配信パフォーマンス</h2>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">日別の推移</p>
        <div className="mt-4 overflow-x-auto rounded-[var(--radius-md)] border border-[color:var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b border-[color:var(--color-border)] text-left text-xs uppercase tracking-wide text-[color:var(--color-text-secondary)]">
                <th className="px-3 py-2">日付</th>
                <th className="px-3 py-2 text-right">友だち数</th>
                <th className="px-3 py-2 text-right">増加</th>
                <th className="px-3 py-2 text-right">ブロック</th>
                <th className="px-3 py-2 text-right">配信数</th>
                <th className="px-3 py-2 text-right">開封率</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {DUMMY_LINE_DAILY.map((m) => (
                <tr key={m.date} className="hover:bg-[color:var(--color-surface-muted)]">
                  <td className="px-3 py-2 font-medium text-[color:var(--color-text-primary)]">{m.date}</td>
                  <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{m.friends.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">
                    <span className="text-green-600">+{m.growth}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-[color:var(--color-text-secondary)]">{m.blocked}</td>
                  <td className="px-3 py-2 text-right text-[color:var(--color-text-secondary)]">{m.messages_sent}</td>
                  <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">
                    {m.open_rate > 0 ? `${m.open_rate}%` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={DUMMY_LINE_DAILY} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#475569' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(v) => v.toLocaleString()} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#475569' }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(value: number, name: string) => {
                if (name === '開封率') return [`${value}%`, name];
                return [value.toLocaleString(), name];
              }} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="friends" name="友だち数" stroke="#06C755" strokeWidth={2} dot={false} />
              <Bar yAxisId="left" dataKey="growth" name="増加数" fill="#06C755" opacity={0.5} />
              <Line yAxisId="right" type="monotone" dataKey="open_rate" name="開封率" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 準備中メッセージ */}
      <div className="ui-card p-8 text-center">
        <p className="text-lg font-medium text-[color:var(--color-text-primary)]">LINE連携機能は準備中です</p>
        <p className="mt-2 text-sm text-[color:var(--color-text-secondary)]">
          今後のアップデートでLINE公式アカウントとの連携機能を追加予定です。
        </p>
      </div>
    </div>
  );
}
