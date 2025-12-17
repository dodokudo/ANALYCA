'use client';

import { useEffect, useState, useMemo, use, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import LoadingScreen from '@/components/LoadingScreen';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

// ============ チャンネル定義 ============
type Channel = 'instagram' | 'threads';

interface UserInfo {
  threads_username?: string | null;
  threads_user_id?: string | null;
  threads_profile_picture_url?: string | null;
  instagram_username?: string | null;
  instagram_user_id?: string | null;
  instagram_profile_picture_url?: string | null;
}

interface DashboardResponse {
  success: boolean;
  data?: {
    reels: {
      total: number;
      data: unknown[];
    };
    stories: {
      total: number;
      data: unknown[];
    };
    threads: {
      total: number;
      data: unknown[];
    };
    insights: unknown;
    lineData: unknown;
    summary: unknown;
  };
  user?: UserInfo;
  channels?: {
    instagram: boolean;
    threads: boolean;
  };
  error?: string;
}

function UserDashboardContent({ userId }: { userId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get('tab') as Channel | null;

  const [dashboardResponse, setDashboardResponse] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/dashboard/${userId}`);
        const result = await response.json();
        if (!result.success) {
          setDashboardResponse({ success: false, error: result.error || 'データの取得に失敗しました' });
        } else {
          setDashboardResponse(result);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        setDashboardResponse({ success: false, error: 'データの取得に失敗しました' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  const hasInstagram = dashboardResponse?.channels?.instagram ?? false;
  const hasThreads = dashboardResponse?.channels?.threads ?? false;
  const dashboardData = dashboardResponse?.data;
  const user = dashboardResponse?.user;

  // チャンネルアイテム（連携済みのみ表示）
  const channelItems = useMemo(() => {
    const items: { value: Channel; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [];
    if (hasInstagram) {
      items.push({ value: 'instagram', label: 'Instagram', Icon: InstagramIcon });
    }
    if (hasThreads) {
      items.push({ value: 'threads', label: 'Threads', Icon: ThreadsIcon });
    }
    return items;
  }, [hasInstagram, hasThreads]);

  // タブはURLパラメータを優先（リフレッシュ時も保持される）
  // Threadsのみの場合はThreadsをデフォルトに
  const activeChannel = useMemo(() => {
    // URLパラメータが明示的に指定されている場合は、それを優先
    if (tabParam === 'threads' && hasThreads) return 'threads';
    if (tabParam === 'instagram' && hasInstagram) return 'instagram';

    // URLパラメータがあるが、そのチャンネルがない場合はフォールバック
    if (tabParam === 'threads' && !hasThreads && hasInstagram) return 'instagram';
    if (tabParam === 'instagram' && !hasInstagram && hasThreads) return 'threads';

    // URLパラメータがない場合のデフォルト
    // Threadsのみの場合はThreadsを、それ以外はInstagramを優先
    if (!tabParam) {
      if (hasThreads && !hasInstagram) return 'threads';
      if (hasInstagram) return 'instagram';
      if (hasThreads) return 'threads';
    }

    // どちらもない場合
    return 'none' as unknown as Channel;
  }, [tabParam, hasInstagram, hasThreads]);

  const setActiveChannel = (channel: Channel) => {
    router.push(`/${userId}?tab=${channel}`, { scroll: false });
  };

  // ユーザー名とプロフィール画像を取得
  const displayName = useMemo(() => {
    if (activeChannel === 'instagram') {
      return user?.instagram_username || user?.threads_username || 'User';
    }
    return user?.threads_username || user?.instagram_username || 'User';
  }, [activeChannel, user]);

  const profilePicture = useMemo(() => {
    if (activeChannel === 'instagram') {
      return user?.instagram_profile_picture_url || user?.threads_profile_picture_url;
    }
    return user?.threads_profile_picture_url || user?.instagram_profile_picture_url;
  }, [activeChannel, user]);

  if (loading) {
    return <LoadingScreen message="データ読み込み中" />;
  }

  if (dashboardResponse?.error) {
    return (
      <div className="min-h-screen bg-[color:var(--color-background)] p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-[var(--radius-lg)] p-6">
            <h3 className="text-red-800 font-semibold">エラー</h3>
            <p className="text-red-600 mt-2">{dashboardResponse.error}</p>
            <Link
              href="/"
              className="inline-block mt-4 text-purple-600 hover:text-purple-800"
            >
              ← ホームに戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 連携がない場合
  if (!hasInstagram && !hasThreads) {
    return (
      <div className="min-h-screen bg-gradient-to-r from-pink-50/70 via-blue-50/50 to-teal-50/30 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <AnalycaLogo size="lg" />
          <h2 className="text-xl font-bold text-gray-800 mt-4">利用可能なデータがありません</h2>
          <p className="text-gray-600 mt-2">
            Instagram または Threads を連携してください。
          </p>
          <Link
            href="/onboarding/light"
            className="inline-block mt-4 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700"
          >
            セットアップへ
          </Link>
        </div>
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
              <p className="text-xs text-[color:var(--color-text-muted)]">@{displayName}</p>
            </div>
          </div>
        </div>

        {/* ユーザープロフィール */}
        <div className="p-4 border-b border-[color:var(--color-border)]">
          <div className="flex items-center gap-3">
            {profilePicture ? (
              <img
                src={profilePicture}
                alt={displayName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-emerald-400 flex items-center justify-center">
                <span className="text-white font-bold">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-[color:var(--color-text-primary)]">{displayName}</p>
              <p className="text-xs text-[color:var(--color-text-muted)]">
                {hasInstagram && hasThreads ? 'Instagram & Threads' : hasInstagram ? 'Instagram' : 'Threads'}
              </p>
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
                  <p className="text-xs text-[color:var(--color-text-muted)]">@{displayName}</p>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-2 text-[color:var(--color-text-secondary)]">
                ✕
              </button>
            </div>
            {/* プロフィール */}
            <div className="p-4 border-b border-[color:var(--color-border)]">
              <div className="flex items-center gap-3">
                {profilePicture ? (
                  <img
                    src={profilePicture}
                    alt={displayName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-emerald-400 flex items-center justify-center">
                    <span className="text-white font-bold">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-[color:var(--color-text-primary)]">{displayName}</p>
                </div>
              </div>
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
        <div className="p-4 lg:p-6 pb-24 lg:pb-6">
          {activeChannel === 'instagram' && <InstagramTab data={dashboardData} />}
          {activeChannel === 'threads' && <ThreadsTab data={dashboardData} />}
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

export default function UserDashboardPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);

  return (
    <Suspense fallback={<LoadingScreen message="データ読み込み中" />}>
      <UserDashboardContent userId={userId} />
    </Suspense>
  );
}

// ============ Instagram タブ ============
function InstagramTab({ data }: { data?: unknown }) {
  if (!data || !(data as {reels?: unknown}).reels || !(data as {stories?: unknown}).stories) {
    return (
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Instagramデータがありません</h2>
        <p className="text-gray-600">Instagramでログインしてデータを取得してください。</p>
        <Link
          href="/login"
          className="inline-block mt-4 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700"
        >
          ログインページへ
        </Link>
      </div>
    );
  }

  const reels = (data as {reels: {data: unknown[]}}).reels.data || [];
  const stories = (data as {stories: {data: unknown[]}}).stories.data || [];
  const totalReels = (data as {reels: {total: number}}).reels.total || 0;
  const totalStories = (data as {stories: {total: number}}).stories.total || 0;
  const totalReelsViews = reels.reduce((sum: number, reel: unknown) => sum + ((reel as {views?: number}).views || 0), 0);
  const totalStoriesViews = stories.reduce((sum: number, story: unknown) => sum + ((story as {views?: number}).views || 0), 0);

  return (
    <div className="space-y-6">
      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <div className="text-sm font-medium text-gray-600 uppercase">リール数</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{totalReels}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <div className="text-sm font-medium text-gray-600 uppercase">ストーリーズ数</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{totalStories}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <div className="text-sm font-medium text-gray-600 uppercase">リール総再生数</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{totalReelsViews.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <div className="text-sm font-medium text-gray-600 uppercase">ストーリーズ総再生数</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{totalStoriesViews.toLocaleString()}</div>
        </div>
      </div>

      {/* リール一覧 */}
      {reels.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">最近のリール</h2>
          <div className="space-y-4">
            {reels.slice(0, 10).map((reel: unknown, idx: number) => {
              const r = reel as {id: string; timestamp: string; views?: number; like_count?: number; comments_count?: number; caption: string};
              return (
                <div key={r.id || idx} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-xs text-gray-500">
                      {new Date(r.timestamp).toLocaleString('ja-JP')}
                    </div>
                    <div className="flex gap-4 text-xs text-gray-600">
                      <span>👁️ {r.views?.toLocaleString()}</span>
                      <span>❤️ {r.like_count?.toLocaleString()}</span>
                      <span>💬 {r.comments_count?.toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-800 line-clamp-2">{r.caption}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Threads タブ ============
interface ThreadsComment {
  id: string;
  comment_id: string;
  parent_post_id: string;
  text: string;
  timestamp: string | null;
  permalink: string;
  has_replies: boolean;
  views: number;
  depth: number;
}

interface ThreadsPostData {
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

function ThreadsTab({ data }: { data?: unknown }) {
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'date' | 'views' | 'likes'>('views');
  const [showAllPosts, setShowAllPosts] = useState(false);

  if (!data || !(data as {threads?: unknown}).threads) {
    return (
      <div className="ui-card p-6">
        <h2 className="text-xl font-bold text-[color:var(--color-text-primary)] mb-4">Threadsデータがありません</h2>
        <p className="text-[color:var(--color-text-secondary)]">Threadsでログインしてデータを取得してください。</p>
        <Link
          href="/onboarding/light"
          className="inline-block mt-4 bg-[color:var(--color-text-primary)] text-white px-6 py-3 rounded-[var(--radius-md)] hover:opacity-90 transition-opacity"
        >
          セットアップへ
        </Link>
      </div>
    );
  }

  const posts = (data as {threads: {data: ThreadsPostData[]}}).threads.data || [];
  const totalPosts = (data as {threads: {total: number}}).threads.total || 0;
  const totalViews = (data as {threads: {totalViews: number}}).threads.totalViews || 0;
  const totalLikes = (data as {threads: {totalLikes: number}}).threads.totalLikes || 0;
  const totalReplies = (data as {threads: {totalReplies: number}}).threads.totalReplies || 0;
  const totalReposts = (data as {threads: {totalReposts?: number}}).threads.totalReposts || 0;
  const totalQuotes = (data as {threads: {totalQuotes?: number}}).threads.totalQuotes || 0;

  const comments = (data as {threadsComments?: {data: ThreadsComment[]}}).threadsComments?.data || [];

  const commentsByPostId = new Map<string, ThreadsComment[]>();
  comments.forEach((comment) => {
    const postId = comment.parent_post_id;
    if (!commentsByPostId.has(postId)) {
      commentsByPostId.set(postId, []);
    }
    commentsByPostId.get(postId)!.push(comment);
  });

  const dailyMetrics = (data as {threadsDailyMetrics?: {data: Array<{date: string; followers_count: number; follower_delta: number; total_views: number; post_count: number}>}}).threadsDailyMetrics?.data || [];
  const latestMetrics = (data as {threadsDailyMetrics?: {latest: {followers_count: number; follower_delta: number} | null}}).threadsDailyMetrics?.latest;
  const followersCount = latestMetrics?.followers_count || 0;

  const totalEngagements: number = totalLikes + totalReplies + totalReposts + totalQuotes;
  const engagementRate = totalViews > 0 ? (totalEngagements / totalViews * 100).toFixed(2) : '0.00';

  const sortedPosts = [...posts].sort((a, b) => {
    switch (sortBy) {
      case 'views':
        return (b.views || 0) - (a.views || 0);
      case 'likes':
        return (b.likes || 0) - (a.likes || 0);
      case 'date':
      default:
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }
  });

  const getFullText = (post: ThreadsPostData): string => {
    const postComments = commentsByPostId.get(post.threads_id) || [];
    if (postComments.length === 0) {
      return post.text || '';
    }
    const sortedComments = [...postComments].sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0));
    const commentParts = sortedComments.map((c, idx) => {
      const label = `【コメント欄${idx + 1}】`;
      return `${label}\n${c.text}`;
    }).filter(Boolean);
    return [post.text, ...commentParts].filter(Boolean).join('\n\n');
  };

  const hasComments = (post: ThreadsPostData): boolean => {
    return (commentsByPostId.get(post.threads_id)?.length || 0) > 0;
  };

  const getCommentCount = (post: ThreadsPostData): number => {
    return commentsByPostId.get(post.threads_id)?.length || 0;
  };

  interface TransitionResult {
    transitions: Array<{from: string; to: string; rate: number; views: number}>;
    overallRate: number | null;
    lastCommentViews: number | null;
  }

  const getTransitionRates = (post: ThreadsPostData): TransitionResult => {
    const postComments = commentsByPostId.get(post.threads_id) || [];
    if (postComments.length === 0 || post.views === 0) {
      return { transitions: [], overallRate: null, lastCommentViews: null };
    }
    const sortedComments = [...postComments].sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0));
    const transitions: Array<{from: string; to: string; rate: number; views: number}> = [];
    if (sortedComments.length > 0) {
      const firstComment = sortedComments[0];
      const rate = (firstComment.views / post.views) * 100;
      transitions.push({ from: 'メイン', to: 'コメント欄1', rate, views: firstComment.views });
    }
    for (let i = 1; i < sortedComments.length; i++) {
      const prevComment = sortedComments[i - 1];
      const currComment = sortedComments[i];
      if (prevComment.views > 0) {
        const rate = (currComment.views / prevComment.views) * 100;
        transitions.push({ from: `コメント欄${i}`, to: `コメント欄${i + 1}`, rate, views: currComment.views });
      }
    }
    const lastComment = sortedComments[sortedComments.length - 1];
    const overallRate = post.views > 0 ? (lastComment.views / post.views) * 100 : null;
    return { transitions, overallRate, lastCommentViews: lastComment.views };
  };

  const INITIAL_DISPLAY_COUNT = 20;
  const displayedPosts = showAllPosts ? sortedPosts : sortedPosts.slice(0, INITIAL_DISPLAY_COUNT);
  const hasMorePosts = sortedPosts.length > INITIAL_DISPLAY_COUNT;

  const dayOfWeekStats: Record<number, {views: number; count: number}> = {};
  const hourStats: Record<number, {views: number; count: number}> = {};
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

  posts.forEach((post: unknown) => {
    const p = post as {timestamp: string; views: number};
    const date = new Date(p.timestamp);
    const day = date.getDay();
    const hour = date.getHours();
    if (!dayOfWeekStats[day]) dayOfWeekStats[day] = {views: 0, count: 0};
    dayOfWeekStats[day].views += p.views || 0;
    dayOfWeekStats[day].count += 1;
    if (!hourStats[hour]) hourStats[hour] = {views: 0, count: 0};
    hourStats[hour].views += p.views || 0;
    hourStats[hour].count += 1;
  });

  const toggleExpand = (postId: string) => {
    const newSet = new Set(expandedPosts);
    if (newSet.has(postId)) {
      newSet.delete(postId);
    } else {
      newSet.add(postId);
    }
    setExpandedPosts(newSet);
  };

  return (
    <div className="section-stack">
      {/* アカウントの概要 */}
      <div className="ui-card">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">アカウントの概要</h2>
            <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">投稿のパフォーマンス指標を確認できます</p>
          </div>
        </header>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-5">
            <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-[0.08em]">フォロワー</dt>
            <dd className="mt-4 text-[2rem] font-semibold leading-none text-[color:var(--color-text-primary)]">{followersCount.toLocaleString()}</dd>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-5">
            <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-[0.08em]">投稿数</dt>
            <dd className="mt-4 text-[2rem] font-semibold leading-none text-[color:var(--color-text-primary)]">{totalPosts}</dd>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-5">
            <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-[0.08em]">閲覧数</dt>
            <dd className="mt-4 text-[2rem] font-semibold leading-none text-[color:var(--color-text-primary)]">{totalViews.toLocaleString()}</dd>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-5">
            <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-[0.08em]">いいね</dt>
            <dd className="mt-4 text-[2rem] font-semibold leading-none text-[color:var(--color-text-primary)]">{totalLikes.toLocaleString()}</dd>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-5">
            <dt className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-[0.08em]">エンゲージメント率</dt>
            <dd className="mt-4 text-[2rem] font-semibold leading-none text-[color:var(--color-text-primary)]">{engagementRate}%</dd>
            <p className="mt-3 text-xs font-medium text-[color:var(--color-text-muted)]">(いいね+返信+リポスト+引用)/閲覧</p>
          </div>
        </dl>
      </div>

      {/* 日別メトリクス推移 */}
      <DailyMetricsSection dailyMetrics={dailyMetrics} />

      {/* 曜日・時間帯別パフォーマンス */}
      {posts.length > 0 && (
        <div className="ui-card">
          <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">曜日・時間帯別パフォーマンス</h2>
          <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">投稿のベストタイミングを分析</p>

          <div className="mt-6 grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-[color:var(--color-text-primary)] mb-3">曜日別 平均閲覧数</h3>
              <div className="space-y-2">
                {[0, 1, 2, 3, 4, 5, 6].map(day => {
                  const stats = dayOfWeekStats[day];
                  const avgViews = stats ? Math.round(stats.views / stats.count) : 0;
                  const maxAvg = Math.max(...Object.values(dayOfWeekStats).map(s => s.views / s.count));
                  const width = maxAvg > 0 ? (avgViews / maxAvg) * 100 : 0;
                  return (
                    <div key={day} className="flex items-center gap-2">
                      <span className="w-6 text-xs text-[color:var(--color-text-secondary)]">{dayNames[day]}</span>
                      <div className="flex-1 h-6 bg-[color:var(--color-surface-muted)] rounded-[var(--radius-sm)] overflow-hidden">
                        <div
                          className="h-full bg-[color:var(--color-accent)] transition-all rounded-[var(--radius-sm)]"
                          style={{width: `${width}%`, opacity: 0.7}}
                        />
                      </div>
                      <span className="w-16 text-xs text-[color:var(--color-text-primary)] text-right">{avgViews.toLocaleString()}</span>
                      <span className="w-8 text-xs text-[color:var(--color-text-muted)]">({stats?.count || 0})</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-[color:var(--color-text-primary)] mb-3">時間帯別 平均閲覧数</h3>
              <div className="grid grid-cols-6 gap-1">
                {[6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map(hour => {
                  const stats = hourStats[hour];
                  const avgViews = stats ? Math.round(stats.views / stats.count) : 0;
                  const maxAvg = Math.max(...Object.values(hourStats).map(s => s.views / s.count));
                  const intensity = maxAvg > 0 ? avgViews / maxAvg : 0;
                  return (
                    <div
                      key={hour}
                      className="aspect-square rounded-[var(--radius-sm)] flex items-center justify-center text-xs font-medium text-[color:var(--color-text-primary)] transition-colors"
                      style={{backgroundColor: `rgba(10, 122, 255, ${0.1 + intensity * 0.6})`}}
                      title={`${hour}時: ${avgViews.toLocaleString()} (${stats?.count || 0}件)`}
                    >
                      {hour}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-[color:var(--color-text-muted)] mt-2">※ 色が濃いほど平均閲覧数が多い時間帯</p>
            </div>
          </div>
        </div>
      )}

      {/* トップコンテンツ */}
      {displayedPosts.length > 0 && (
        <div className="ui-card">
          <header className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">トップコンテンツ</h2>
              <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
                選択期間内で反応が高かった投稿を表示しています。
                ({showAllPosts ? sortedPosts.length : Math.min(sortedPosts.length, INITIAL_DISPLAY_COUNT)}/{sortedPosts.length}件)
              </p>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'views' | 'likes')}
              className="h-9 w-40 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
            >
              <option value="views">閲覧数</option>
              <option value="likes">いいね数</option>
              <option value="date">投稿日</option>
            </select>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {displayedPosts.map((post, idx: number) => {
              const p = post as ThreadsPostData;
              const isExpanded = expandedPosts.has(p.id);
              const fullText = getFullText(p);
              const postHasComments = hasComments(p);
              const lineCount = (p.text?.match(/\n/g) || []).length;
              const needsExpand = p.text && (p.text.length > 80 || lineCount >= 2 || postHasComments);

              const formatDate = (timestamp: string) => {
                if (!timestamp) return '-';
                const date = new Date(timestamp);
                if (isNaN(date.getTime())) return '-';
                return date.toLocaleString('ja-JP', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  weekday: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                });
              };

              const displayText = isExpanded ? fullText : (p.text || '(テキストなし)');
              const commentCount = getCommentCount(p);
              const { transitions: transitionRates, overallRate } = getTransitionRates(p);
              const isTop10 = idx < 10;
              const rank = idx + 1;

              return (
                <div
                  key={p.id || idx}
                  className={`rounded-[var(--radius-md)] border bg-white p-3 shadow-[var(--shadow-soft)] cursor-pointer ${
                    isTop10 ? 'border-amber-300 bg-amber-50/30' : 'border-[color:var(--color-border)]'
                  }`}
                  onClick={() => toggleExpand(p.id)}
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
                      <span>{formatDate(p.timestamp)}</span>
                      {postHasComments && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                          コメント欄{commentCount}つ
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span>閲覧 {p.views.toLocaleString()}</span>
                      <span>いいね {p.likes.toLocaleString()}</span>
                      <span>返信 {p.replies.toLocaleString()}</span>
                    </div>
                  </div>
                  {transitionRates.length > 0 && (
                    <div className="mt-2 rounded-md bg-gradient-to-r from-purple-50 to-indigo-50 p-2 border border-purple-100">
                      <div className="flex items-center gap-1 flex-wrap text-[10px]">
                        <div className="flex flex-col items-center">
                          <span className="text-gray-500">メイン</span>
                          <span className="font-bold text-gray-700">{p.views.toLocaleString()}</span>
                        </div>
                        {transitionRates.map((t, tIdx) => {
                          const isFirstTransition = tIdx === 0;
                          const colorClass = isFirstTransition
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
                      {overallRate !== null && transitionRates.length > 1 && (
                        <div className="mt-1 pt-1 border-t border-purple-200 flex items-center gap-1 text-[10px]">
                          <span className="text-gray-500">全体遷移率:</span>
                          <span className={`font-bold ${overallRate >= 1 ? 'text-blue-600' : 'text-gray-500'}`}>
                            {overallRate.toFixed(2)}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="mt-2 text-sm text-[color:var(--color-text-primary)] whitespace-pre-wrap">
                    {isExpanded ? displayText : (p.text ? (p.text.length > 80 ? p.text.slice(0, 80) + '…' : p.text) : '(テキストなし)')}
                  </p>

                  {needsExpand && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleExpand(p.id); }}
                      className="mt-2 text-xs text-[color:var(--color-accent)] hover:opacity-80 block"
                    >
                      {isExpanded ? '▲ 折りたたむ' : (postHasComments ? `▼ 全文を表示（コメント欄${commentCount}つ）` : '▼ 全文を表示')}
                    </button>
                  )}
                  {p.permalink && (
                    <a
                      href={p.permalink}
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

// ============ 日別メトリクスセクション ============
interface DailyMetric {
  date: string;
  followers_count: number;
  follower_delta: number;
  total_views: number;
  post_count: number;
}

type DateRangeFilter = '3days' | '7days' | '30days' | 'all';

function DailyMetricsSection({ dailyMetrics }: { dailyMetrics: DailyMetric[] }) {
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('7days');

  const filteredByRange = useMemo(() => {
    if (dailyMetrics.length === 0) return [];
    if (dateRange === 'all') return dailyMetrics;
    const days = dateRange === '3days' ? 3 : dateRange === '7days' ? 7 : 30;
    const sorted = [...dailyMetrics].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return sorted.slice(0, days);
  }, [dailyMetrics, dateRange]);

  const sortedMetrics = useMemo(() => {
    return [...filteredByRange].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [filteredByRange, sortOrder]);

  const chartData = useMemo(() => {
    return [...filteredByRange]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(m => ({
        date: m.date.slice(5),
        フォロワー: m.followers_count,
        インプレッション: m.total_views,
        増減: m.follower_delta,
      }));
  }, [filteredByRange]);

  const rangeOptions: { value: DateRangeFilter; label: string }[] = [
    { value: '3days', label: '過去3日' },
    { value: '7days', label: '過去7日' },
    { value: '30days', label: '過去30日' },
    { value: 'all', label: '全期間' },
  ];

  if (dailyMetrics.length === 0) return null;

  return (
    <div className="ui-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">インプレッション & フォロワー推移</h2>
          <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">日別のパフォーマンスを確認できます</p>
        </div>
        <div className="flex gap-1">
          {rangeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setDateRange(option.value)}
              className={`px-3 py-1.5 text-sm rounded-[var(--radius-md)] transition-colors ${
                dateRange === option.value
                  ? 'bg-[color:var(--color-text-primary)] text-white font-medium'
                  : 'text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-muted)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-[var(--radius-md)] border border-[color:var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr className="border-b border-[color:var(--color-border)] text-left text-xs uppercase tracking-wide text-[color:var(--color-text-secondary)]">
              <th className="px-3 py-2">
                <button
                  onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                  className="flex items-center gap-1 hover:text-[color:var(--color-text-primary)]"
                >
                  日付
                  <span className="text-xs">{sortOrder === 'desc' ? '▼' : '▲'}</span>
                </button>
              </th>
              <th className="px-3 py-2 text-right">フォロワー</th>
              <th className="px-3 py-2 text-right">増減</th>
              <th className="px-3 py-2 text-right">投稿数</th>
              <th className="px-3 py-2 text-right">閲覧数</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-border)]">
            {sortedMetrics.map((m) => (
              <tr key={m.date} className="hover:bg-[color:var(--color-surface-muted)]">
                <td className="px-3 py-2 font-medium text-[color:var(--color-text-primary)]">{m.date}</td>
                <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{m.followers_count.toLocaleString()}</td>
                <td className="px-3 py-2 text-right">
                  <span className={m.follower_delta > 0 ? 'text-green-600' : m.follower_delta < 0 ? 'text-red-600' : 'text-[color:var(--color-text-secondary)]'}>
                    {m.follower_delta > 0 ? `+${m.follower_delta}` : m.follower_delta || '0'}
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
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} tickFormatter={(v) => v.toLocaleString()} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} tickFormatter={(v) => v.toLocaleString()} />
            <Tooltip
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              formatter={(value: number, name: string) => [value.toLocaleString(), name]}
            />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="フォロワー" stroke="#8b5cf6" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
            <Line yAxisId="right" type="monotone" dataKey="インプレッション" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
