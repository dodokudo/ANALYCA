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
      <path d="M17.688 10.937c-.03-.014-.062-.027-.092-.04-.185-3.413-2.05-5.367-5.182-5.387h-.043c-1.873 0-3.431.799-4.39 2.255l1.722 1.181c.716-1.087 1.84-1.319 2.668-1.319h.029c1.031.007 1.809.307 2.313.891.366.426.612 1.014.733 1.756-.914-.155-1.903-.203-2.96-.142-2.978.171-4.891 1.908-4.764 4.321.065 1.224.675 2.277 1.717 2.965.881.581 2.015.866 3.195.801 1.557-.085 2.779-.679 3.631-1.764.647-.823 1.058-1.884 1.239-3.224.743.448 1.293 1.041 1.612 1.755.542 1.214.574 3.206-1.207 4.988-1.555 1.555-3.425 2.226-6.072 2.249-2.934-.025-5.156-.959-6.606-2.777-1.355-1.699-2.06-4.14-2.094-7.266.034-3.125.739-5.567 2.094-7.266 1.45-1.818 3.672-2.752 6.606-2.777 2.954.025 5.186.964 6.643 2.797.718.903 1.246 2.018 1.58 3.333l1.964-.469c-.39-1.536-1.031-2.875-1.923-3.994-1.836-2.304-4.553-3.486-8.074-3.518h-.013c-3.771.033-6.444 1.237-8.197 3.416-1.69 2.101-2.565 5.057-2.602 8.79v.006c.037 3.733.912 6.688 2.602 8.789 1.753 2.179 4.426 3.383 8.197 3.416h.013c3.088-.025 5.448-.854 7.43-2.608 2.261-2.003 2.644-4.767 1.827-6.599-.588-1.316-1.683-2.348-3.23-3.056zm-5.684 6.314c-1.307.071-2.665-.514-2.759-1.793-.07-.951.674-2.012 2.954-2.143.259-.015.512-.022.762-.022.782 0 1.515.075 2.177.222-.248 3.02-1.783 3.665-3.134 3.736z"/>
    </svg>
  );
}

// ============ 型定義 ============
type Channel = 'instagram' | 'threads';

type DatePreset = '3d' | '7d' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth';

const datePresetOptions: { value: DatePreset; label: string }[] = [
  { value: '3d', label: '過去3日' },
  { value: '7d', label: '過去7日' },
  { value: 'thisWeek', label: '今週' },
  { value: 'lastWeek', label: '先週' },
  { value: 'thisMonth', label: '今月' },
  { value: 'lastMonth', label: '先月' },
];

// 日付範囲を計算するヘルパー関数
function getDateRange(preset: DatePreset): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);

  switch (preset) {
    case '3d': {
      const start = new Date(today);
      start.setDate(start.getDate() - 3);
      return { start, end };
    }
    case '7d': {
      const start = new Date(today);
      start.setDate(start.getDate() - 7);
      return { start, end };
    }
    case 'thisWeek': {
      // 今週（日曜日始まり）
      const dayOfWeek = today.getDay();
      const start = new Date(today);
      start.setDate(start.getDate() - dayOfWeek);
      return { start, end };
    }
    case 'lastWeek': {
      // 先週（日曜日〜土曜日）
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

// 日付が範囲内かチェック
function isDateInRange(dateStr: string | Date | null | undefined, range: { start: Date; end: Date }): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  return date >= range.start && date <= range.end;
}

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
  const isSyncing = searchParams?.get('syncing') === 'true';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [channels, setChannels] = useState<{ instagram: boolean; threads: boolean }>({ instagram: false, threads: false });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSyncBanner, setShowSyncBanner] = useState(isSyncing);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  // データ取得関数
  const fetchData = async (showLoadingState = true) => {
    try {
      if (showLoadingState) setLoading(true);
      const response = await fetch(`/api/dashboard/${userId}`);
      const result = await response.json();
      if (!result.success) {
        setError(result.error || 'データの取得に失敗しました');
      } else {
        setUser(result.user || null);
        setData(result.data || null);
        setChannels(result.channels || { instagram: false, threads: false });
        setLastUpdated(new Date());
      }
    } catch {
      setError('データの取得に失敗しました');
    } finally {
      if (showLoadingState) setLoading(false);
    }
  };

  // 手動同期関数（現在のユーザーのみ同期）
  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      // 連携しているチャンネルに応じて同期APIを呼び出し（userIdを指定）
      const syncPromises: Promise<Response>[] = [];
      if (channels.instagram) {
        syncPromises.push(fetch(`/api/sync/instagram/reels?userId=${userId}`, { method: 'GET' }));
        syncPromises.push(fetch(`/api/sync/instagram/stories?userId=${userId}`, { method: 'GET' }));
      }
      if (channels.threads) {
        syncPromises.push(fetch(`/api/sync/threads/posts?userId=${userId}`, { method: 'GET' }));
      }
      await Promise.all(syncPromises);
      // 同期完了後にデータ再取得
      await fetchData(false);
    } catch (err) {
      console.error('Manual sync failed:', err);
    } finally {
      setIsManualSyncing(false);
    }
  };

  // 初回データ取得
  useEffect(() => {
    fetchData();
  }, [userId]);

  // 同期中の場合、30秒後に再取得し、60秒後にバナーを非表示
  useEffect(() => {
    if (!showSyncBanner) return;

    // 30秒後にデータ再取得
    const refreshTimer = setTimeout(() => {
      fetchData(false);
    }, 30000);

    // 60秒後にバナー非表示
    const hideTimer = setTimeout(() => {
      setShowSyncBanner(false);
      // URLからsyncingパラメータを削除
      const url = new URL(window.location.href);
      url.searchParams.delete('syncing');
      window.history.replaceState({}, '', url.toString());
    }, 60000);

    return () => {
      clearTimeout(refreshTimer);
      clearTimeout(hideTimer);
    };
  }, [showSyncBanner]);

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
    // 履歴を汚さないようタブ変更は置き換え
    router.replace(`/${userId}?tab=${channel}`, { scroll: false });
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
      {/* 同期中バナー */}
      {showSyncBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-blue-500 text-white px-4 py-3 flex items-center justify-center gap-3">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-medium">データを同期中です...しばらくお待ちください</span>
          <button
            onClick={() => {
              setShowSyncBanner(false);
              // URLからsyncingパラメータを削除
              const url = new URL(window.location.href);
              url.searchParams.delete('syncing');
              window.history.replaceState({}, '', url.toString());
            }}
            className="ml-4 text-white/80 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

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
          {/* 同期ステータスバー */}
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                {lastUpdated
                  ? `最終更新: ${lastUpdated.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`
                  : '読み込み中...'}
              </span>
            </div>
            <button
              onClick={handleManualSync}
              disabled={isManualSyncing}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className={`w-4 h-4 ${isManualSyncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {isManualSyncing ? '同期中...' : '再同期'}
            </button>
          </div>

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
  const allPosts = data?.threads?.data || [];
  const comments = data?.threadsComments?.data || [];
  const allDailyMetrics = data?.threadsDailyMetrics?.data || [];
  const latestMetrics = data?.threadsDailyMetrics?.latest;
  const followersCount = latestMetrics?.followers_count || 0;

  // 日付範囲でフィルタリング
  const dateRange = useMemo(() => getDateRange(datePreset), [datePreset]);

  const posts = useMemo(() => {
    return allPosts.filter(p => isDateInRange(p.timestamp, dateRange));
  }, [allPosts, dateRange]);

  const dailyMetrics = useMemo(() => {
    return allDailyMetrics.filter(d => isDateInRange(d.date, dateRange));
  }, [allDailyMetrics, dateRange]);

  // フィルタ後の合計を計算（日別メトリクスから期間内の合計を取得）
  const totalPosts = dailyMetrics.reduce((sum, d) => sum + (d.post_count || 0), 0);
  const totalViews = dailyMetrics.reduce((sum, d) => sum + (d.total_views || 0), 0);
  const totalLikes = dailyMetrics.reduce((sum, d) => sum + (d.total_likes || 0), 0);
  const totalReplies = dailyMetrics.reduce((sum, d) => sum + (d.total_replies || 0), 0);

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
    const engagementRate = totalViews > 0 ? ((totalLikes + totalReplies) / totalViews * 100).toFixed(2) : '0.00';
    const followerGrowth = dailyMetrics.reduce((sum, d) => sum + d.follower_delta, 0);
    return { totalViews, totalLikes, totalReplies, engagementRate, followerGrowth };
  }, [totalViews, totalLikes, totalReplies, dailyMetrics]);

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
    const postViews = post.views || 0;
    if (!postComments.length || postViews === 0) return { transitions: [], overallRate: null };
    const transitions: { from: string; to: string; rate: number; views: number }[] = [];
    const sorted = [...postComments].sort((a, b) => (a.depth || 0) - (b.depth || 0));

    if (sorted.length > 0) {
      const firstViews = sorted[0]?.views || 0;
      transitions.push({ from: 'メイン', to: 'コメント欄1', rate: postViews > 0 ? (firstViews / postViews) * 100 : 0, views: firstViews });
    }
    for (let i = 1; i < sorted.length; i++) {
      const prevViews = sorted[i - 1]?.views || 0;
      const currViews = sorted[i]?.views || 0;
      if (prevViews > 0) {
        transitions.push({
          from: `コメント欄${i}`,
          to: `コメント欄${i + 1}`,
          rate: (currViews / prevViews) * 100,
          views: currViews,
        });
      }
    }
    const last = sorted[sorted.length - 1];
    const lastViews = last?.views || 0;
    const overallRate = postViews > 0 ? (lastViews / postViews) * 100 : null;
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

  const allReels: InstagramReel[] = (data?.reels?.data || []) as InstagramReel[];
  const allStories: InstagramStory[] = (data?.stories?.data || []) as InstagramStory[];
  const allInsights: InstagramInsight[] = ((data?.insights as { data?: InstagramInsight[] })?.data || []) as InstagramInsight[];
  const latestInsight = allInsights[0] || null;
  const followersCount = latestInsight?.followers_count || 0;

  // 日付範囲でフィルタリング
  const dateRange = useMemo(() => getDateRange(datePreset), [datePreset]);

  const reels = useMemo(() => {
    return allReels.filter(r => isDateInRange(r.timestamp, dateRange));
  }, [allReels, dateRange]);

  const stories = useMemo(() => {
    return allStories.filter(s => isDateInRange(s.timestamp, dateRange));
  }, [allStories, dateRange]);

  const insights = useMemo(() => {
    return allInsights.filter(i => isDateInRange(i.date, dateRange));
  }, [allInsights, dateRange]);

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
              {/* 最大・最小値表示 */}
              <div className="flex gap-6 mb-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-[color:var(--color-text-muted)]">フォロワー:</span>
                  <span className="text-green-600 font-medium">最大 {Math.max(...insights.map(i => i.followers_count || 0)).toLocaleString()}</span>
                  <span className="text-gray-400">/</span>
                  <span className="text-red-500 font-medium">最小 {Math.min(...insights.filter(i => i.followers_count).map(i => i.followers_count || 0)).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[color:var(--color-text-muted)]">リーチ:</span>
                  <span className="text-green-600 font-medium">最大 {Math.max(...insights.map(i => i.reach || 0)).toLocaleString()}</span>
                  <span className="text-gray-400">/</span>
                  <span className="text-red-500 font-medium">最小 {Math.min(...insights.filter(i => i.reach).map(i => i.reach || 0)).toLocaleString()}</span>
                </div>
              </div>
              {/* グラフ */}
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={[...insights].reverse()} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(v) => v ? String(v).slice(5) : ''} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(v) => v != null ? v.toLocaleString() : ''} domain={[0, 'dataMax']} allowDataOverflow={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#6B7280' }} domain={[0, 'dataMax']} allowDataOverflow={false} />
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
                  const viewRate = followersCount > 0 ? (((story.views || 0) / followersCount) * 100).toFixed(1) : '0.0';
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
              {/* 最大・最小値表示 */}
              <div className="flex flex-wrap gap-4 mb-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-[color:var(--color-text-muted)]">リーチ:</span>
                  <span className="text-green-600 font-medium">最大 {Math.max(...insights.map(i => i.reach || 0)).toLocaleString()}</span>
                  <span className="text-gray-400">/</span>
                  <span className="text-red-500 font-medium">最小 {Math.min(...insights.filter(i => i.reach).map(i => i.reach || 0)).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[color:var(--color-text-muted)]">プロフ表示:</span>
                  <span className="text-green-600 font-medium">最大 {Math.max(...insights.map(i => i.profile_views || 0)).toLocaleString()}</span>
                  <span className="text-gray-400">/</span>
                  <span className="text-red-500 font-medium">最小 {Math.min(...insights.filter(i => i.profile_views).map(i => i.profile_views || 0)).toLocaleString()}</span>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={[...insights].reverse()} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(v) => v ? String(v).slice(5) : ''} />
                    <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(v) => v != null ? v.toLocaleString() : ''} domain={[0, 'dataMax']} allowDataOverflow={false} />
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
