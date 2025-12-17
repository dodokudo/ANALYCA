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
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// ============ アイコンコンポーネント ============
function AnalycaLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };
  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };
  return (
    <div className={`${sizeClasses[size]} bg-gradient-to-r from-purple-500 to-emerald-400 rounded-lg flex items-center justify-center`}>
      <svg className={`${iconSizes[size]} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    </div>
  );
}

function InstagramIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

function ThreadsIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.5 12.068V12c.013-3.501.87-6.338 2.495-8.435C5.853 1.483 8.604.287 12.127.264h.014c2.914.017 5.4.835 7.392 2.432 1.99 1.596 3.268 3.855 3.798 6.716l-2.153.485c-.428-2.292-1.407-4.065-2.91-5.274-1.503-1.21-3.437-1.829-5.75-1.843h-.011c-2.886.019-5.09.959-6.55 2.795-1.306 1.642-2.002 3.974-2.012 6.732v.058c.006 2.802.697 5.15 2 6.801 1.457 1.847 3.66 2.797 6.551 2.817 2.368-.018 4.216-.623 5.661-1.851.526-.447.967-.953 1.332-1.494l1.814 1.113c-.498.74-1.1 1.414-1.819 2.022-1.823 1.548-4.161 2.365-6.963 2.432zm4.18-7.789c-.609-1.99-2.208-3.166-4.556-3.385-.166-.015-.335-.023-.507-.023-1.5 0-2.728.5-3.548 1.444-.73.838-1.088 1.989-1.006 3.232.094 1.45.621 2.504 1.52 3.044.77.462 1.782.626 2.787.452 1.182-.205 2.116-.785 2.697-1.68.347-.535.573-1.165.676-1.87.055-.379.079-.768.079-1.154 0-.34-.015-.682-.044-1.016l2.028-.215c.042.478.063.968.063 1.46 0 .504-.033 1.018-.1 1.528-.15 1.017-.467 1.952-.942 2.77-.87 1.497-2.286 2.536-4.093 3.004-1.547.401-3.203.297-4.58-.286-1.57-.666-2.719-1.994-3.053-3.534l2.102-.373c.213.961.892 1.63 1.866 1.837.7.149 1.532.108 2.306-.114 1.136-.326 1.981-.946 2.443-1.793a3.56 3.56 0 0 0 .425-1.272c.01-.053.018-.107.025-.162l-.003-.014c-.42.39-.917.706-1.474.93-.742.298-1.565.451-2.418.451-.368 0-.742-.028-1.117-.085-1.61-.247-2.867-1.02-3.638-2.237-.67-1.058-1.018-2.426-1.007-3.961.012-1.773.541-3.38 1.488-4.52 1.096-1.322 2.751-2.05 4.657-2.05.265 0 .534.013.806.04 2.862.28 4.965 1.729 6.081 4.188.432.95.713 2.013.838 3.162l-2.022.215-.006-.044c-.095-.929-.316-1.76-.658-2.472z"/>
    </svg>
  );
}

function LineIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
    </svg>
  );
}

// ============ チャンネル定義 ============
type Channel = 'instagram' | 'threads' | 'line';

const channelItems: { value: Channel; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'instagram', label: 'Instagram', Icon: InstagramIcon },
  { value: 'threads', label: 'Threads', Icon: ThreadsIcon },
  { value: 'line', label: 'LINE', Icon: LineIcon },
];

// ============ 日付プリセット ============
type DatePreset = 'yesterday' | 'this-week' | 'last-week' | 'this-month' | 'last-month' | '7d' | '30d';

const datePresetOptions: { value: DatePreset; label: string }[] = [
  { value: '7d', label: '過去7日' },
  { value: '30d', label: '過去30日' },
  { value: 'yesterday', label: '昨日' },
  { value: 'this-week', label: '今週' },
  { value: 'last-week', label: '先週' },
  { value: 'this-month', label: '今月' },
  { value: 'last-month', label: '先月' },
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
const DUMMY_LINE_SUMMARY = {
  totalFriends: 2450,
  surveyResponses: 1842,
  surveyRate: 75.2,
  friendsGrowth7d: 89,
  friendsGrowth30d: 342,
};

const DUMMY_LINE_DAILY = [
  { date: '2024-12-10', friends: 2320, growth: 12, survey: 8, surveyRate: 66.7, blocked: 2, messages_sent: 1, open_count: 1580, click_count: 245 },
  { date: '2024-12-11', friends: 2340, growth: 20, survey: 16, surveyRate: 80.0, blocked: 1, messages_sent: 0, open_count: 0, click_count: 0 },
  { date: '2024-12-12', friends: 2360, growth: 20, survey: 14, surveyRate: 70.0, blocked: 2, messages_sent: 1, open_count: 1720, click_count: 312 },
  { date: '2024-12-13', friends: 2390, growth: 30, survey: 25, surveyRate: 83.3, blocked: 3, messages_sent: 2, open_count: 1650, click_count: 278 },
  { date: '2024-12-14', friends: 2410, growth: 20, survey: 15, surveyRate: 75.0, blocked: 1, messages_sent: 1, open_count: 1780, click_count: 356 },
  { date: '2024-12-15', friends: 2435, growth: 25, survey: 19, surveyRate: 76.0, blocked: 2, messages_sent: 0, open_count: 0, click_count: 0 },
  { date: '2024-12-16', friends: 2450, growth: 15, survey: 12, surveyRate: 80.0, blocked: 1, messages_sent: 1, open_count: 1820, click_count: 389 },
];

const DUMMY_LINE_SOURCES = [
  { name: 'Threads', count: 1250, percentage: 51.0 },
  { name: 'Instagram', count: 680, percentage: 27.8 },
  { name: '検索', count: 320, percentage: 13.1 },
  { name: 'その他', count: 200, percentage: 8.2 },
];

// 属性分析データ
const DUMMY_LINE_DEMOGRAPHICS = {
  gender: [
    { name: '女性', value: 68, color: '#EC4899' },
    { name: '男性', value: 28, color: '#3B82F6' },
    { name: '未回答', value: 4, color: '#9CA3AF' },
  ],
  age: [
    { name: '〜19歳', value: 5, color: '#22D3EE' },
    { name: '20-29歳', value: 32, color: '#06B6D4' },
    { name: '30-39歳', value: 38, color: '#0891B2' },
    { name: '40-49歳', value: 18, color: '#0E7490' },
    { name: '50歳〜', value: 7, color: '#155E75' },
  ],
  prefecture: [
    { name: '東京都', value: 28 },
    { name: '神奈川県', value: 15 },
    { name: '大阪府', value: 12 },
    { name: '愛知県', value: 8 },
    { name: 'その他', value: 37 },
  ],
};

const PIE_COLORS = ['#06C755', '#E1306C', '#3B82F6', '#9CA3AF'];

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
      <div className="min-h-screen bg-gradient-to-r from-pink-50/70 via-blue-50/50 to-teal-50/30 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--color-accent)]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-pink-50/70 via-blue-50/50 to-teal-50/30 flex">
      {/* サイドバー（PC） */}
      <aside className="hidden lg:flex lg:flex-col lg:w-56 bg-[color:var(--color-surface)] border-r border-[color:var(--color-border)] fixed h-full z-40">
        {/* ANALYCAロゴ */}
        <div className="p-4 border-b border-[color:var(--color-border)]">
          <div className="flex items-center gap-3">
            <AnalycaLogo size="md" />
            <div>
              <h1 className="text-xl font-bold text-[color:var(--color-text-primary)]">ANALYCA</h1>
              <p className="text-xs text-[color:var(--color-text-muted)]">Demo Account</p>
            </div>
          </div>
        </div>

        {/* チャンネル切替 */}
        <nav className="flex-1 p-3 space-y-1">
          {channelItems.map((channel) => {
            const Icon = channel.Icon;
            return (
              <button
                key={channel.value}
                onClick={() => setActiveChannel(channel.value)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors ${
                  activeChannel === channel.value
                    ? 'bg-[color:var(--color-accent)] text-white'
                    : 'text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)]'
                }`}
              >
                <Icon className="w-5 h-5" />
                {channel.label}
              </button>
            );
          })}
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
              <div className="flex items-center gap-3">
                <AnalycaLogo size="sm" />
                <div>
                  <h1 className="text-lg font-bold text-[color:var(--color-text-primary)]">ANALYCA</h1>
                  <p className="text-xs text-[color:var(--color-text-muted)]">Demo Account</p>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-2 text-[color:var(--color-text-secondary)]">
                ✕
              </button>
            </div>
            <nav className="p-3 space-y-1">
              {channelItems.map((channel) => {
                const Icon = channel.Icon;
                return (
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
                    <Icon className="w-5 h-5" />
                    {channel.label}
                  </button>
                );
              })}
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
          <AnalycaLogo size="sm" />
          <h1 className="text-lg font-bold text-[color:var(--color-text-primary)]">ANALYCA</h1>
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
          {channelItems.map((channel) => {
            const Icon = channel.Icon;
            return (
              <button
                key={channel.value}
                onClick={() => setActiveChannel(channel.value)}
                className={`flex flex-col items-center px-4 py-1 ${
                  activeChannel === channel.value
                    ? 'text-[color:var(--color-accent)]'
                    : 'text-[color:var(--color-text-muted)]'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs mt-1">{channel.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

// ============ Instagram デモ ============
type IGTab = 'overview' | 'reels' | 'stories' | 'daily';

function InstagramDemo() {
  const [activeTab, setActiveTab] = useState<IGTab>('overview');
  const [datePreset, setDatePreset] = useState<DatePreset>('7d');
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
      {/* ヘッダー: タブ + 日付選択 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <select
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value as DatePreset)}
          className="h-9 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-text-secondary)]"
        >
          {datePresetOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
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

          {/* パフォーマンス推移 */}
          <div className="ui-card p-6">
            <h3 className="text-lg font-semibold text-[color:var(--color-text-primary)]">パフォーマンス推移</h3>
            <p className="mt-1 text-sm text-[color:var(--color-text-secondary)] mb-4">日別のパフォーマンス</p>
            <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[color:var(--color-border)]">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="border-b border-[color:var(--color-border)] text-left text-xs uppercase tracking-wide text-[color:var(--color-text-secondary)]">
                    <th className="px-3 py-2">日付</th>
                    <th className="px-3 py-2 text-right">フォロワー</th>
                    <th className="px-3 py-2 text-right">増減</th>
                    <th className="px-3 py-2 text-right">リーチ</th>
                    <th className="px-3 py-2 text-right">プロフ表示</th>
                    <th className="px-3 py-2 text-right">クリック</th>
                    <th className="px-3 py-2 text-right">ストーリー</th>
                    <th className="px-3 py-2 text-right">ST閲覧数</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)]">
                  {DUMMY_IG_DAILY_DATA.slice().reverse().map((row) => (
                    <tr key={row.date} className="hover:bg-[color:var(--color-surface-muted)]">
                      <td className="px-3 py-2 font-medium text-[color:var(--color-text-primary)]">{row.date}</td>
                      <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{row.followers.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">
                        <span className="text-green-600">+{row.growth}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{row.reach.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{row.profileViews.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{row.webClicks}</td>
                      <td className="px-3 py-2 text-right text-[color:var(--color-text-secondary)]">{row.storyCount}</td>
                      <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{row.storyViews.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 h-72">
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

          {/* ストーリーTOP5 */}
          <div className="ui-card p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="text-lg font-semibold text-[color:var(--color-text-primary)]">ストーリーTOP5</h3>
              <button onClick={() => setActiveTab('stories')} className="h-9 px-3 text-sm font-medium rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)]">
                詳細
              </button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-1">
              {sortedStories.slice(0, 5).map((story) => {
                const viewRate = ((story.views / story.followers) * 100).toFixed(1);
                return (
                  <div key={story.id} className="flex min-w-[160px] flex-shrink-0 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white shadow-sm">
                    <div className="relative aspect-[9/16] w-full bg-[color:var(--color-surface-muted)]">
                      <img src={story.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                    </div>
                    <div className="p-3 space-y-1">
                      <p className="text-xs text-[color:var(--color-text-muted)]">{story.date}</p>
                      <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">{story.views.toLocaleString()} 閲覧</p>
                      <p className="text-xs text-[color:var(--color-text-secondary)]">{viewRate}% 閲覧率</p>
                    </div>
                  </div>
                );
              })}
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
  const [datePreset, setDatePreset] = useState<DatePreset>('7d');

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
    const followerGrowth = DUMMY_THREADS_DAILY.reduce((sum, d) => sum + d.follower_delta, 0);
    return { totalViews, totalLikes, totalReplies, engagementRate, followerGrowth };
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
      {/* ヘッダー: タブ + 日付選択 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button className="h-9 rounded-[var(--radius-sm)] px-3 text-sm font-medium bg-[color:var(--color-text-primary)] text-white">
            ホーム
          </button>
        </div>
        <select
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value as DatePreset)}
          className="h-9 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-text-secondary)]"
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
          <div className="ui-card p-6 h-full flex flex-col justify-center">
            <div className="flex items-center mb-4">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-[color:var(--color-surface-muted)] mr-4">
                <img src={DUMMY_THREADS_USER.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">{DUMMY_THREADS_USER.username}</h2>
                <p className="text-xs text-[color:var(--color-text-muted)]">フォロワー数</p>
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-2xl font-semibold text-[color:var(--color-text-primary)] mr-3">{DUMMY_THREADS_USER.followers_count.toLocaleString()}</span>
              <span className="text-sm font-medium text-green-500">+{summary.followerGrowth}</span>
            </div>
          </div>
        </div>
        {/* 右側：KPI */}
        <div className="lg:col-span-9">
          <div className="ui-card p-6">
            <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)] mb-6">パフォーマンス指標</h2>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-4">
                <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wide">投稿数</dt>
                <dd className="mt-2 text-2xl font-semibold text-[color:var(--color-text-primary)]">{DUMMY_THREADS_POSTS.length}</dd>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-4">
                <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wide">閲覧数</dt>
                <dd className="mt-2 text-2xl font-semibold text-[color:var(--color-text-primary)]">{summary.totalViews.toLocaleString()}</dd>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-4">
                <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wide">いいね</dt>
                <dd className="mt-2 text-2xl font-semibold text-[color:var(--color-text-primary)]">{summary.totalLikes.toLocaleString()}</dd>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-4">
                <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wide">エンゲージメント率</dt>
                <dd className="mt-2 text-2xl font-semibold text-[color:var(--color-text-primary)]">{summary.engagementRate}%</dd>
              </div>
            </dl>
          </div>
        </div>
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
            <ComposedChart data={DUMMY_THREADS_DAILY} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(v) => v.slice(5)} />
              <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(v) => v.toLocaleString()} />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12, fill: '#475569' }}
                domain={[
                  (dataMin: number) => Math.floor(dataMin * 0.99),
                  (dataMax: number) => Math.ceil(dataMax * 1.01)
                ]}
              />
              <Tooltip formatter={(value: number, name: string) => [value.toLocaleString(), name]} />
              <Legend />
              <Bar yAxisId="left" dataKey="total_views" name="閲覧数" fill="#6366f1" opacity={0.7} />
              <Line yAxisId="right" type="monotone" dataKey="followers_count" name="フォロワー" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
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

// ============ LINE デモ（AutoStudio風） ============
type LineTab = 'main' | 'daily';

function LineDemo() {
  const [activeTab, setActiveTab] = useState<LineTab>('main');
  const [datePreset, setDatePreset] = useState<DatePreset>('7d');

  const tabItems: { value: LineTab; label: string }[] = [
    { value: 'main', label: 'メイン' },
    { value: 'daily', label: 'デイリー' },
  ];

  // 日別データの集計
  const dailyStats = useMemo(() => {
    const totalMessages = DUMMY_LINE_DAILY.reduce((sum, d) => sum + d.messages_sent, 0);
    const totalOpen = DUMMY_LINE_DAILY.filter(d => d.open_count > 0).reduce((sum, d) => sum + d.open_count, 0);
    const totalClick = DUMMY_LINE_DAILY.filter(d => d.click_count > 0).reduce((sum, d) => sum + d.click_count, 0);
    const daysWithMessages = DUMMY_LINE_DAILY.filter(d => d.messages_sent > 0).length;
    const avgOpenRate = daysWithMessages > 0 ? ((totalOpen / (DUMMY_LINE_SUMMARY.targetReach * daysWithMessages)) * 100).toFixed(1) : '0.0';
    const avgCtr = totalOpen > 0 ? ((totalClick / totalOpen) * 100).toFixed(1) : '0.0';
    return { totalMessages, totalOpen, totalClick, avgOpenRate, avgCtr };
  }, []);

  return (
    <div className="section-stack pb-20 lg:pb-6">
      {/* ヘッダー: タブ + 日付選択 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <select
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value as DatePreset)}
          className="h-9 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-text-secondary)]"
        >
          {datePresetOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* メインタブ */}
      {activeTab === 'main' && (
        <>
          {/* アカウントの概要（KPIカード） */}
          <div className="ui-card">
            <header>
              <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">アカウントの概要</h2>
              <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">LINE公式アカウントの指標</p>
            </header>
            <dl className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-5">
                <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wide">友だち登録数</dt>
                <dd className="mt-4 text-[2rem] font-semibold leading-none text-[color:var(--color-text-primary)]">{DUMMY_LINE_SUMMARY.totalFriends.toLocaleString()}</dd>
                <p className="mt-2 text-xs text-green-600">+{DUMMY_LINE_SUMMARY.friendsGrowth7d} (7日間)</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-5">
                <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wide">アンケート回答数</dt>
                <dd className="mt-4 text-[2rem] font-semibold leading-none text-[color:var(--color-text-primary)]">{DUMMY_LINE_SUMMARY.surveyResponses.toLocaleString()}</dd>
                <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">累計回答者数</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-5">
                <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wide">アンケート回答率</dt>
                <dd className="mt-4 text-[2rem] font-semibold leading-none text-[color:var(--color-text-primary)]">{DUMMY_LINE_SUMMARY.surveyRate}%</dd>
                <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">回答数 / 登録数</p>
              </div>
            </dl>
          </div>

          {/* デイリーデータ & 流入分析 */}
          <div className="ui-card">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* 左側：デイリーデータ */}
              <div>
                <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">デイリーデータ</h2>
                <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">日別のLINE指標</p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[color:var(--color-border)]">
                        <th className="text-left py-2 px-2 text-[color:var(--color-text-secondary)] font-medium">日付</th>
                        <th className="text-right py-2 px-2 text-[color:var(--color-text-secondary)] font-medium">登録数</th>
                        <th className="text-right py-2 px-2 text-[color:var(--color-text-secondary)] font-medium">回答数</th>
                        <th className="text-right py-2 px-2 text-[color:var(--color-text-secondary)] font-medium">回答率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DUMMY_LINE_DAILY.slice().reverse().map((day) => (
                        <tr key={day.date} className="border-b border-[color:var(--color-border)] last:border-0">
                          <td className="py-2 px-2 text-[color:var(--color-text-primary)]">{day.date.slice(5)}</td>
                          <td className="py-2 px-2 text-right text-[color:var(--color-text-primary)]">+{day.growth}</td>
                          <td className="py-2 px-2 text-right text-[color:var(--color-text-primary)]">{day.survey}</td>
                          <td className="py-2 px-2 text-right text-[color:var(--color-text-primary)]">{day.surveyRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* 右側：流入分析 */}
              <div>
                <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">流入分析</h2>
                <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">友だち登録の流入元</p>
                <div className="mt-4 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={DUMMY_LINE_SOURCES}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        dataKey="count"
                        nameKey="name"
                      >
                        {DUMMY_LINE_SOURCES.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [value.toLocaleString(), '登録数']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-2">
                  {DUMMY_LINE_SOURCES.map((source, idx) => (
                    <div key={source.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                        <span className="text-[color:var(--color-text-primary)]">{source.name}</span>
                      </div>
                      <span className="text-[color:var(--color-text-secondary)]">{source.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 属性分析 */}
          <div className="ui-card">
            <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">属性分析</h2>
            <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">友だちの属性情報</p>
            <div className="mt-6 grid md:grid-cols-3 gap-6">
              {/* 性別 */}
              <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-4">
                <h3 className="text-sm font-medium text-[color:var(--color-text-secondary)] mb-4">性別</h3>
                <div className="space-y-3">
                  {DUMMY_LINE_DEMOGRAPHICS.gender.map((item) => (
                    <div key={item.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[color:var(--color-text-primary)]">{item.name}</span>
                        <span className="font-medium text-[color:var(--color-text-primary)]">{item.value}%</span>
                      </div>
                      <div className="h-2 bg-[color:var(--color-surface-muted)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* 年代 */}
              <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-4">
                <h3 className="text-sm font-medium text-[color:var(--color-text-secondary)] mb-4">年代</h3>
                <div className="space-y-3">
                  {DUMMY_LINE_DEMOGRAPHICS.age.map((item) => (
                    <div key={item.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[color:var(--color-text-primary)]">{item.name}</span>
                        <span className="font-medium text-[color:var(--color-text-primary)]">{item.value}%</span>
                      </div>
                      <div className="h-2 bg-[color:var(--color-surface-muted)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* 都道府県 */}
              <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-4">
                <h3 className="text-sm font-medium text-[color:var(--color-text-secondary)] mb-4">都道府県</h3>
                <div className="space-y-3">
                  {DUMMY_LINE_DEMOGRAPHICS.prefecture.map((item, idx) => (
                    <div key={item.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[color:var(--color-text-primary)]">{item.name}</span>
                        <span className="font-medium text-[color:var(--color-text-primary)]">{item.value}%</span>
                      </div>
                      <div className="h-2 bg-[color:var(--color-surface-muted)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#06C755]" style={{ width: `${item.value}%`, opacity: 1 - idx * 0.15 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* デイリータブ */}
      {activeTab === 'daily' && (
        <>
          <div className="ui-card p-6">
            <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)] mb-4">配信パフォーマンス</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={DUMMY_LINE_DAILY.filter(d => d.messages_sent > 0)} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(v) => v.toLocaleString()} />
                  <Tooltip formatter={(value: number, name: string) => [value.toLocaleString(), name]} />
                  <Legend />
                  <Bar dataKey="open_count" name="開封数" fill="#06C755" />
                  <Bar dataKey="click_count" name="クリック数" fill="#3B82F6" />
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
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right">友だち数</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right">増加</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right">ブロック</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right">配信数</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right">開封数</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right">クリック数</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)]">
                  {DUMMY_LINE_DAILY.map((row) => (
                    <tr key={row.date} className="hover:bg-[color:var(--color-surface-muted)]">
                      <td className="px-3 py-3 text-[color:var(--color-text-primary)]">{row.date}</td>
                      <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right">{row.friends.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right"><span className="text-green-600">+{row.growth}</span></td>
                      <td className="px-3 py-3 text-[color:var(--color-text-secondary)] text-right">{row.blocked}</td>
                      <td className="px-3 py-3 text-[color:var(--color-text-secondary)] text-right">{row.messages_sent}</td>
                      <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right">{row.open_count > 0 ? row.open_count.toLocaleString() : '-'}</td>
                      <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right">{row.click_count > 0 ? row.click_count.toLocaleString() : '-'}</td>
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
