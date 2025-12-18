'use client';

import { useState, useEffect, useMemo, use, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import LoadingScreen from '@/components/LoadingScreen';
import AnalycaLogo from '@/components/AnalycaLogo';
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

// ============ ユーティリティ関数 ============
// 安全な日付フォーマット（nullやundefinedでもエラーにならない）
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

// 安全なタイムスタンプ取得（ソート用）
function safeGetTime(timestamp: string | Date | null | undefined): number {
  if (!timestamp) return 0;
  try {
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  } catch {
    return 0;
  }
}

// ============ アイコンコンポーネント ============
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

// ============ 型定義 ============
type Channel = 'instagram' | 'threads';

type DatePreset = '7d' | '30d';

const datePresetOptions: { value: DatePreset; label: string }[] = [
  { value: '7d', label: '過去7日' },
  { value: '30d', label: '過去30日' },
];

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
  post_count: number;
}

interface UserInfo {
  threads_username?: string | null;
  threads_profile_picture_url?: string | null;
  instagram_username?: string | null;
  instagram_profile_picture_url?: string | null;
}

interface DashboardData {
  threads?: {
    total: number;
    totalViews: number;
    totalLikes: number;
    totalReplies: number;
    totalReposts?: number;
    totalQuotes?: number;
    data: ThreadsPost[];
  };
  threadsComments?: {
    data: ThreadsComment[];
  };
  threadsDailyMetrics?: {
    data: DailyMetric[];
    latest: { followers_count: number; follower_delta: number } | null;
  };
  reels?: { total: number; data: unknown[] };
  stories?: { total: number; data: unknown[] };
  insights?: {
    latest: { followers_count: number; reach?: number; profile_views?: number; website_clicks?: number } | null;
    data: unknown[];
  };
}

// ============ メインコンポーネント ============
function UserDashboardContent({ userId }: { userId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get('tab') as Channel | null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [channels, setChannels] = useState<{ instagram: boolean; threads: boolean }>({ instagram: false, threads: false });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/dashboard/${userId}`);
        const result = await response.json();
        if (!result.success) {
          setError(result.error || 'データの取得に失敗しました');
        } else {
          setUser(result.user || null);
          setData(result.data || null);
          setChannels(result.channels || { instagram: false, threads: false });
        }
      } catch {
        setError('データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  // 連携チャンネルのみ表示
  const channelItems = useMemo(() => {
    const items: { value: Channel; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [];
    if (channels.instagram) {
      items.push({ value: 'instagram', label: 'Instagram', Icon: InstagramIcon });
    }
    if (channels.threads) {
      items.push({ value: 'threads', label: 'Threads', Icon: ThreadsIcon });
    }
    return items;
  }, [channels]);

  // アクティブチャンネル（Threadsのみの場合はThreadsがデフォルト）
  const activeChannel = useMemo(() => {
    if (tabParam === 'threads' && channels.threads) return 'threads';
    if (tabParam === 'instagram' && channels.instagram) return 'instagram';
    if (!tabParam) {
      if (channels.threads && !channels.instagram) return 'threads';
      if (channels.instagram) return 'instagram';
      if (channels.threads) return 'threads';
    }
    return 'threads';
  }, [tabParam, channels]);

  const setActiveChannel = (channel: Channel) => {
    router.push(`/${userId}?tab=${channel}`, { scroll: false });
  };

  // ユーザー名
  const username = useMemo(() => {
    if (activeChannel === 'instagram') {
      return user?.instagram_username || user?.threads_username || 'User';
    }
    return user?.threads_username || user?.instagram_username || 'User';
  }, [activeChannel, user]);

  // プロフィール画像
  const profilePicture = useMemo(() => {
    if (activeChannel === 'instagram') {
      return user?.instagram_profile_picture_url || user?.threads_profile_picture_url;
    }
    return user?.threads_profile_picture_url || user?.instagram_profile_picture_url;
  }, [activeChannel, user]);

  if (loading) {
    return <LoadingScreen message="データ読み込み中" />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-r from-pink-50/70 via-blue-50/50 to-teal-50/30 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-red-600 mb-4">エラー</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!channels.instagram && !channels.threads) {
    return (
      <div className="min-h-screen bg-gradient-to-r from-pink-50/70 via-blue-50/50 to-teal-50/30 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <AnalycaLogo size="lg" />
          <h2 className="text-xl font-bold text-gray-800 mt-4">データがありません</h2>
          <p className="text-gray-600 mt-2">Instagram または Threads を連携してください。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-pink-50/70 via-blue-50/50 to-teal-50/30 flex">
      {/* サイドバー（PC） */}
      <aside className="hidden lg:flex lg:flex-col lg:w-56 bg-[color:var(--color-surface)] border-r border-[color:var(--color-border)] fixed h-full z-40">
        <div className="p-4 border-b border-[color:var(--color-border)]">
          <div className="flex items-center gap-3">
            <AnalycaLogo size="md" />
            <div>
              <h1 className="text-xl font-bold text-[color:var(--color-text-primary)]">ANALYCA</h1>
              <p className="text-xs text-[color:var(--color-text-muted)]">@{username}</p>
            </div>
          </div>
        </div>

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

        <div className="p-4 border-t border-[color:var(--color-border)]">
          <p className="text-xs text-[color:var(--color-text-muted)]">Powered by ANALYCA</p>
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
                  <p className="text-xs text-[color:var(--color-text-muted)]">@{username}</p>
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

        <div className="p-4 lg:p-6">
          {activeChannel === 'threads' && (
            <ThreadsContent
              user={user}
              data={data}
              username={username}
              profilePicture={profilePicture}
            />
          )}
          {activeChannel === 'instagram' && (
            <InstagramContent
              user={user}
              data={data}
              username={username}
              profilePicture={profilePicture}
            />
          )}
        </div>
      </main>

      {/* モバイルボトムナビ */}
      {channelItems.length > 1 && (
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
      )}
    </div>
  );
}

// ============ Threads コンテンツ（デモと同じUI） ============
function ThreadsContent({
  user,
  data,
  username,
  profilePicture,
}: {
  user: UserInfo | null;
  data: DashboardData | null;
  username: string;
  profilePicture: string | undefined;
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

  // データ取得
  const posts = data?.threads?.data || [];
  const comments = data?.threadsComments?.data || [];
  const dailyMetrics = data?.threadsDailyMetrics?.data || [];
  const latestMetrics = data?.threadsDailyMetrics?.latest;
  const followersCount = latestMetrics?.followers_count || 0;
  const totalPosts = data?.threads?.total || posts.length;
  const totalViews = data?.threads?.totalViews || 0;
  const totalLikes = data?.threads?.totalLikes || 0;
  const totalReplies = data?.threads?.totalReplies || 0;
  const totalReposts = data?.threads?.totalReposts || 0;
  const totalQuotes = data?.threads?.totalQuotes || 0;

  // コメント紐付け
  const commentsByPostId = useMemo(() => {
    const map = new Map<string, ThreadsComment[]>();
    comments.forEach((c) => {
      if (!map.has(c.parent_post_id)) map.set(c.parent_post_id, []);
      map.get(c.parent_post_id)!.push(c);
    });
    return map;
  }, [comments]);

  // サマリー計算
  const summary = useMemo(() => {
    const engagementRate = totalViews > 0 ? ((totalLikes + totalReplies + totalReposts + totalQuotes) / totalViews * 100).toFixed(2) : '0.00';
    const followerGrowth = dailyMetrics.reduce((sum, d) => sum + d.follower_delta, 0);
    return { totalViews, totalLikes, totalReplies, engagementRate, followerGrowth };
  }, [totalViews, totalLikes, totalReplies, totalReposts, totalQuotes, dailyMetrics]);

  // ソート
  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      if (sortBy === 'views') return (b.views || 0) - (a.views || 0);
      if (sortBy === 'likes') return (b.likes || 0) - (a.likes || 0);
      return safeGetTime(b.timestamp) - safeGetTime(a.timestamp);
    });
  }, [posts, sortBy]);

  // 遷移率計算
  const getTransitionRates = (post: ThreadsPost) => {
    const postComments = commentsByPostId.get(post.threads_id) || [];
    if (!postComments.length || post.views === 0) return { transitions: [], overallRate: null };
    const transitions: { from: string; to: string; rate: number; views: number }[] = [];
    const sorted = [...postComments].sort((a, b) => a.depth - b.depth);

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
                {profilePicture ? (
                  <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-purple-500 to-emerald-400 text-white text-xl font-bold">
                    {username.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">{username}</h2>
                <p className="text-xs text-[color:var(--color-text-muted)]">フォロワー数</p>
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-2xl font-semibold text-[color:var(--color-text-primary)] mr-3">{followersCount.toLocaleString()}</span>
              <span className={`text-sm font-medium ${summary.followerGrowth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {summary.followerGrowth >= 0 ? '+' : ''}{summary.followerGrowth}
              </span>
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
                <dd className="mt-2 text-2xl font-semibold text-[color:var(--color-text-primary)]">{totalPosts}</dd>
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
      {dailyMetrics.length > 0 && (
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
                {dailyMetrics.slice().reverse().map((m, idx) => (
                  <tr key={m.date || idx} className="hover:bg-[color:var(--color-surface-muted)]">
                    <td className="px-3 py-2 font-medium text-[color:var(--color-text-primary)]">{m.date || '-'}</td>
                    <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{(m.followers_count || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={(m.follower_delta || 0) > 0 ? 'text-green-600' : (m.follower_delta || 0) < 0 ? 'text-red-600' : 'text-[color:var(--color-text-secondary)]'}>
                        {(m.follower_delta || 0) > 0 ? `+${m.follower_delta}` : m.follower_delta || '0'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-[color:var(--color-text-secondary)]">{m.post_count || 0}</td>
                    <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{(m.total_views || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyMetrics} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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

      {/* トップコンテンツ */}
      {displayedPosts.length > 0 && (
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
              const postComments = commentsByPostId.get(post.threads_id) || [];

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
                                <span className="text-gray-400">→</span>
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

                  <p className="mt-2 text-sm text-[color:var(--color-text-primary)] whitespace-pre-wrap">
                    {isExpanded ? post.text : (post.text && post.text.length > 80 ? post.text.slice(0, 80) + '…' : post.text || '(テキストなし)')}
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
      )}
    </div>
  );
}

// ============ Instagram コンテンツ（デモと同じUI） ============
interface InstagramReel {
  id: string;
  caption?: string;
  media_type?: string;
  permalink?: string;
  timestamp: string;
  views: number;
  reach?: number;
  like_count: number;
  comments_count: number;
  saved?: number;
  shares?: number;
  total_interactions?: number;
  avg_watch_time_seconds?: number;
  thumbnail_url?: string;
}

interface InstagramStory {
  id: string;
  timestamp: string;
  views: number;
  reach?: number;
  replies?: number;
  total_interactions?: number;
  follows?: number;
  profile_visits?: number;
  navigation?: number;
  thumbnail_url?: string;
}

interface InstagramInsight {
  date: string;
  followers_count: number;
  posts_count?: number;
  reach?: number;
  engagement?: number;
  profile_views?: number;
  website_clicks?: number;
}

type IGTab = 'overview' | 'reels' | 'stories' | 'daily';

function InstagramContent({
  data,
  username,
  profilePicture,
}: {
  user: UserInfo | null;
  data: DashboardData | null;
  username: string;
  profilePicture: string | undefined;
}) {
  const [activeTab, setActiveTab] = useState<IGTab>('overview');
  const [datePreset, setDatePreset] = useState<DatePreset>('7d');
  const [reelSortBy, setReelSortBy] = useState('views');
  const [storySortBy, setStorySortBy] = useState('views');

  const reels: InstagramReel[] = (data?.reels?.data || []) as InstagramReel[];
  const stories: InstagramStory[] = (data?.stories?.data || []) as InstagramStory[];
  const insights: InstagramInsight[] = ((data?.insights as { data?: InstagramInsight[] })?.data || []) as InstagramInsight[];
  const latestInsight = insights[0] || null;
  const followersCount = latestInsight?.followers_count || 0;

  const summary = useMemo(() => {
    const totalReach = insights.reduce((sum, d) => sum + (d.reach || 0), 0);
    const totalProfileViews = insights.reduce((sum, d) => sum + (d.profile_views || 0), 0);
    const totalWebClicks = insights.reduce((sum, d) => sum + (d.website_clicks || 0), 0);
    const totalReelsViews = reels.reduce((sum, r) => sum + (r.views || 0), 0);
    const totalReelsLikes = reels.reduce((sum, r) => sum + (r.like_count || 0), 0);
    const totalStoriesViews = stories.reduce((sum, s) => sum + (s.views || 0), 0);
    // フォロワー増減を計算（日別データから）
    const followerGrowth = insights.length > 1
      ? (insights[0]?.followers_count || 0) - (insights[insights.length - 1]?.followers_count || 0)
      : 0;
    return { totalReach, totalProfileViews, totalWebClicks, totalReelsViews, totalReelsLikes, totalStoriesViews, followerGrowth };
  }, [insights, reels, stories]);

  const sortedReels = useMemo(() => {
    return [...reels].sort((a, b) => {
      if (reelSortBy === 'date') return safeGetTime(b.timestamp) - safeGetTime(a.timestamp);
      if (reelSortBy === 'views') return (b.views || 0) - (a.views || 0);
      if (reelSortBy === 'likes') return (b.like_count || 0) - (a.like_count || 0);
      if (reelSortBy === 'saves') return (b.saved || 0) - (a.saved || 0);
      return 0;
    });
  }, [reels, reelSortBy]);

  const sortedStories = useMemo(() => {
    return [...stories].sort((a, b) => {
      if (storySortBy === 'date') return safeGetTime(b.timestamp) - safeGetTime(a.timestamp);
      if (storySortBy === 'views') return (b.views || 0) - (a.views || 0);
      if (storySortBy === 'viewRate') return ((b.views || 0) / followersCount) - ((a.views || 0) / followersCount);
      return 0;
    });
  }, [stories, storySortBy, followersCount]);

  const tabItems: { value: IGTab; label: string }[] = [
    { value: 'overview', label: '概要' },
    { value: 'reels', label: 'リール' },
    { value: 'stories', label: 'ストーリー' },
    { value: 'daily', label: 'デイリー' },
  ];

  if (!reels.length && !stories.length && !insights.length) {
    return (
      <div className="ui-card p-6 text-center">
        <h2 className="text-xl font-bold text-[color:var(--color-text-primary)] mb-4">Instagramデータがありません</h2>
        <p className="text-[color:var(--color-text-secondary)]">データの同期を待っています...</p>
      </div>
    );
  }

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
          {/* アカウント情報 + ファネル分析 */}
          <div className="grid lg:grid-cols-12 gap-4">
            {/* アカウント情報 */}
            <div className="lg:col-span-3">
              <div className="ui-card p-6 h-full flex flex-col justify-center">
                <div className="flex items-center mb-4">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-[color:var(--color-surface-muted)] mr-4">
                    {profilePicture ? (
                      <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xl font-bold">
                        {username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">{username}</h2>
                    <p className="text-xs text-[color:var(--color-text-muted)]">現在のフォロワー数</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <span className="text-2xl font-semibold text-[color:var(--color-text-primary)] mr-3">{followersCount.toLocaleString()}</span>
                  {summary.followerGrowth !== 0 && (
                    <span className={`text-sm font-medium ${summary.followerGrowth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {summary.followerGrowth >= 0 ? '+' : ''}{summary.followerGrowth.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ファネル分析 */}
            <div className="lg:col-span-9">
              <div className="ui-card p-6">
                <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)] mb-6">ファネル分析</h2>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-medium uppercase tracking-[0.08em] text-[color:var(--color-text-secondary)] mb-2">リーチ</span>
                    <span className="text-xl font-semibold text-[color:var(--color-text-primary)]">{summary.totalReach.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col items-center mx-2">
                    <div className="text-lg text-emerald-500">→</div>
                    <span className="text-xs font-medium text-emerald-500">{summary.totalReach > 0 ? ((summary.totalProfileViews / summary.totalReach) * 100).toFixed(1) : '0'}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-medium uppercase tracking-[0.08em] text-[color:var(--color-text-secondary)] mb-2">プロフ表示</span>
                    <span className="text-xl font-semibold text-[color:var(--color-text-primary)]">{summary.totalProfileViews.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col items-center mx-2">
                    <div className="text-lg text-emerald-500">→</div>
                    <span className="text-xs font-medium text-emerald-500">{summary.totalProfileViews > 0 ? ((summary.totalWebClicks / summary.totalProfileViews) * 100).toFixed(1) : '0'}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-medium uppercase tracking-[0.08em] text-[color:var(--color-text-secondary)] mb-2">リンククリック</span>
                    <span className="text-xl font-semibold text-[color:var(--color-text-primary)]">{summary.totalWebClicks.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col items-center mx-2">
                    <div className="text-lg text-emerald-500">→</div>
                    <span className="text-xs font-medium text-emerald-500">{summary.totalWebClicks > 0 ? ((summary.followerGrowth / summary.totalWebClicks) * 100).toFixed(1) : '0'}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-medium uppercase tracking-[0.08em] text-[color:var(--color-text-secondary)] mb-2">フォロワー増加</span>
                    <span className="text-xl font-semibold text-[color:var(--color-text-primary)]">{summary.followerGrowth.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* パフォーマンス推移（テーブル + グラフ） */}
          {insights.length > 0 && (
            <div className="ui-card p-6">
              <h3 className="text-lg font-semibold text-[color:var(--color-text-primary)]">パフォーマンス推移</h3>
              <p className="mt-1 text-sm text-[color:var(--color-text-secondary)] mb-4">日別のパフォーマンス</p>
              {/* デイリーテーブル */}
              <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[color:var(--color-border)] mb-6">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="border-b border-[color:var(--color-border)] text-left text-xs uppercase tracking-wide text-[color:var(--color-text-secondary)]">
                      <th className="px-3 py-2">日付</th>
                      <th className="px-3 py-2 text-right">フォロワー</th>
                      <th className="px-3 py-2 text-right">増減</th>
                      <th className="px-3 py-2 text-right">リーチ</th>
                      <th className="px-3 py-2 text-right">プロフ表示</th>
                      <th className="px-3 py-2 text-right">クリック</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--color-border)]">
                    {[...insights].reverse().map((row, idx, arr) => {
                      // 増減を計算（前日との差分）
                      const prevRow = arr[idx + 1];
                      const growth = prevRow ? (row.followers_count || 0) - (prevRow.followers_count || 0) : 0;
                      return (
                        <tr key={row.date || idx} className="hover:bg-[color:var(--color-surface-muted)]">
                          <td className="px-3 py-2 font-medium text-[color:var(--color-text-primary)]">{row.date || '-'}</td>
                          <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{(row.followers_count || 0).toLocaleString()}</td>
                          <td className="px-3 py-2 text-right">
                            <span className={growth > 0 ? 'text-green-600' : growth < 0 ? 'text-red-600' : 'text-[color:var(--color-text-secondary)]'}>
                              {growth > 0 ? `+${growth}` : growth}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{(row.reach || 0).toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{(row.profile_views || 0).toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{(row.website_clicks || 0).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* グラフ */}
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={[...insights].reverse()} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(v) => v ? String(v).slice(5) : ''} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(v) => v != null ? v.toLocaleString() : ''} domain={['dataMin - 50', 'dataMax + 50']} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <Tooltip formatter={(value: number | null, name: string) => [value != null ? value.toLocaleString() : '-', name]} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="followers_count" name="フォロワー数" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                    <Bar yAxisId="right" dataKey="reach" name="リーチ" fill="#8B5CF6" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* リールTOP5 */}
          {sortedReels.length > 0 && (
            <div className="ui-card p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-[color:var(--color-text-primary)]">リールTOP5</h3>
                  <p className="text-xs text-[color:var(--color-text-muted)]">期間内の上位コンテンツ</p>
                </div>
                <button onClick={() => setActiveTab('reels')} className="h-9 px-3 text-sm font-medium rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)]">
                  詳細
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-1">
                {sortedReels.slice(0, 5).map((reel) => (
                  <div key={reel.id} className="flex min-w-[180px] flex-shrink-0 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white shadow-sm">
                    <div className="relative aspect-[9/16] w-full bg-[color:var(--color-surface-muted)]">
                      {reel.thumbnail_url ? (
                        <img src={reel.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-[color:var(--color-text-muted)]">
                          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 p-3">
                      <p className="text-xs text-[color:var(--color-text-muted)]">{safeFormatDate(reel.timestamp)}</p>
                      <dl className="space-y-1 text-sm text-[color:var(--color-text-secondary)]">
                        <div className="flex items-center justify-between">
                          <dt className="font-medium text-[color:var(--color-text-muted)]">再生数</dt>
                          <dd className="font-semibold text-[color:var(--color-text-primary)]">{(reel.views || 0).toLocaleString()}</dd>
                        </div>
                        <div className="flex items-center justify-between">
                          <dt className="font-medium text-[color:var(--color-text-muted)]">いいね</dt>
                          <dd className="font-semibold text-[color:var(--color-text-primary)]">{(reel.like_count || 0).toLocaleString()}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ストーリーTOP5 */}
          {sortedStories.length > 0 && (
            <div className="ui-card p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-[color:var(--color-text-primary)]">ストーリーTOP5</h3>
                  <p className="text-xs text-[color:var(--color-text-muted)]">期間内の上位コンテンツ</p>
                </div>
                <button onClick={() => setActiveTab('stories')} className="h-9 px-3 text-sm font-medium rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-muted)]">
                  詳細
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-1">
                {sortedStories.slice(0, 5).map((story) => {
                  const viewRate = followersCount > 0 ? ((story.views / followersCount) * 100).toFixed(1) : '0.0';
                  return (
                    <div key={story.id} className="flex min-w-[180px] flex-shrink-0 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white shadow-sm">
                      <div className="relative aspect-[9/16] w-full bg-[color:var(--color-surface-muted)]">
                        {story.thumbnail_url ? (
                          <img src={story.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-[color:var(--color-text-muted)]">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 p-3">
                        <p className="text-xs text-[color:var(--color-text-muted)]">{safeFormatDate(story.timestamp)}</p>
                        <dl className="space-y-1 text-sm text-[color:var(--color-text-secondary)]">
                          <div className="flex items-center justify-between">
                            <dt className="font-medium text-[color:var(--color-text-muted)]">閲覧数</dt>
                            <dd className="font-semibold text-[color:var(--color-text-primary)]">{(story.views || 0).toLocaleString()}</dd>
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
          )}
        </>
      )}

      {/* リールタブ */}
      {activeTab === 'reels' && (
        <div className="ui-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">リール一覧</h2>
              <p className="text-xs text-[color:var(--color-text-muted)]">表示件数 {sortedReels.length}</p>
            </div>
            <select value={reelSortBy} onChange={(e) => setReelSortBy(e.target.value)} className="h-9 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-text-secondary)]">
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
                    {reel.thumbnail_url ? (
                      <img src={reel.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-[color:var(--color-text-muted)]">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  <p className="text-xs text-[color:var(--color-text-muted)]">{safeFormatDate(reel.timestamp)}</p>
                  {reel.caption && <p className="text-sm text-[color:var(--color-text-primary)] line-clamp-2">{reel.caption}</p>}
                  <dl className="grid grid-cols-2 gap-y-2 text-sm text-[color:var(--color-text-secondary)] sm:grid-cols-3">
                    <div><dt className="text-[color:var(--color-text-muted)]">再生数</dt><dd className="font-semibold text-[color:var(--color-text-primary)]">{(reel.views || 0).toLocaleString()}</dd></div>
                    <div><dt className="text-[color:var(--color-text-muted)]">いいね</dt><dd className="font-semibold text-[color:var(--color-text-primary)]">{(reel.like_count || 0).toLocaleString()}</dd></div>
                    <div><dt className="text-[color:var(--color-text-muted)]">コメント</dt><dd className="font-semibold text-[color:var(--color-text-primary)]">{(reel.comments_count || 0).toLocaleString()}</dd></div>
                    <div><dt className="text-[color:var(--color-text-muted)]">保存</dt><dd className="font-semibold text-[color:var(--color-text-primary)]">{(reel.saved || 0).toLocaleString()}</dd></div>
                  </dl>
                  {reel.permalink && (
                    <a href={reel.permalink} target="_blank" rel="noopener noreferrer" className="text-xs text-[color:var(--color-accent)] hover:underline">
                      Instagramで見る →
                    </a>
                  )}
                </div>
              </div>
            ))}
            {sortedReels.length === 0 && (
              <p className="text-center text-[color:var(--color-text-muted)] py-8">リールがありません</p>
            )}
          </div>
        </div>
      )}

      {/* ストーリータブ */}
      {activeTab === 'stories' && (
        <div className="ui-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">ストーリー一覧</h2>
              <p className="text-xs text-[color:var(--color-text-muted)]">表示件数 {sortedStories.length}</p>
            </div>
            <select value={storySortBy} onChange={(e) => setStorySortBy(e.target.value)} className="h-9 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-text-secondary)]">
              <option value="date">日付</option>
              <option value="views">閲覧数</option>
              <option value="viewRate">閲覧率</option>
            </select>
          </div>
          <div className="space-y-4">
            {sortedStories.map((story) => {
              const viewRate = followersCount > 0 ? ((story.views / followersCount) * 100).toFixed(1) : '0.0';
              return (
                <div key={story.id} className="flex gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white p-4 shadow-sm">
                  <div className="relative w-[90px] flex-shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)]">
                    <div className="aspect-[9/16]">
                      {story.thumbnail_url ? (
                        <img src={story.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[color:var(--color-text-muted)]">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <p className="text-xs text-[color:var(--color-text-muted)]">{safeFormatDate(story.timestamp)}</p>
                    <dl className="grid grid-cols-2 gap-y-2 text-sm text-[color:var(--color-text-secondary)] sm:grid-cols-3">
                      <div><dt className="text-[color:var(--color-text-muted)]">閲覧数</dt><dd className="font-semibold text-[color:var(--color-text-primary)]">{(story.views || 0).toLocaleString()}</dd></div>
                      <div><dt className="text-[color:var(--color-text-muted)]">閲覧率</dt><dd className="font-semibold text-[color:var(--color-text-primary)]">{viewRate}%</dd></div>
                      <div><dt className="text-[color:var(--color-text-muted)]">リーチ</dt><dd className="font-semibold text-[color:var(--color-text-primary)]">{(story.reach || 0).toLocaleString()}</dd></div>
                      <div><dt className="text-[color:var(--color-text-muted)]">返信</dt><dd className="font-semibold text-[color:var(--color-text-primary)]">{(story.replies || 0)}</dd></div>
                    </dl>
                  </div>
                </div>
              );
            })}
            {sortedStories.length === 0 && (
              <p className="text-center text-[color:var(--color-text-muted)] py-8">ストーリーがありません</p>
            )}
          </div>
        </div>
      )}

      {/* デイリータブ */}
      {activeTab === 'daily' && (
        <>
          {/* デイリーグラフ */}
          {insights.length > 0 && (
            <div className="ui-card p-6">
              <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)] mb-4">デイリー推移</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={[...insights].reverse()} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(v) => v ? String(v).slice(5) : ''} />
                    <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(v) => v != null ? v.toLocaleString() : ''} />
                    <Tooltip formatter={(value: number | null, name: string) => [value != null ? value.toLocaleString() : '-', name]} />
                    <Legend />
                    <Bar dataKey="reach" name="リーチ" fill="#10B981" />
                    <Bar dataKey="profile_views" name="プロフ表示" fill="#3B82F6" />
                    <Bar dataKey="website_clicks" name="リンククリック" fill="#6366F1" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* デイリーテーブル */}
          <div className="ui-card p-6">
            <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)] mb-4">デイリーデータ</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--color-border)] text-left">
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] whitespace-nowrap">日付</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right whitespace-nowrap">フォロワー</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right whitespace-nowrap">リーチ</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right whitespace-nowrap">プロフ表示</th>
                    <th className="px-3 py-3 font-semibold text-[color:var(--color-text-primary)] text-right whitespace-nowrap">リンククリック</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)]">
                  {insights.map((row, idx) => (
                    <tr key={row.date || idx} className="hover:bg-[color:var(--color-surface-muted)]">
                      <td className="px-3 py-3 text-[color:var(--color-text-primary)] whitespace-nowrap">{row.date || '-'}</td>
                      <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right whitespace-nowrap">{(row.followers_count || 0).toLocaleString()}</td>
                      <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right whitespace-nowrap">{(row.reach || 0).toLocaleString()}</td>
                      <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right whitespace-nowrap">{(row.profile_views || 0).toLocaleString()}</td>
                      <td className="px-3 py-3 text-[color:var(--color-text-primary)] text-right whitespace-nowrap">{(row.website_clicks || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {insights.length === 0 && (
                <p className="text-center text-[color:var(--color-text-muted)] py-8">デイリーデータがありません</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============ エクスポート ============
export default function UserDashboardPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);

  return (
    <Suspense fallback={<LoadingScreen message="データ読み込み中" />}>
      <UserDashboardContent userId={userId} />
    </Suspense>
  );
}
