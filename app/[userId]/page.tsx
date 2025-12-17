'use client';

import { useEffect, useState, useMemo, use } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import LoadingScreen from '@/components/LoadingScreen';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

export default function UserDashboardPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const [dashboardResponse, setDashboardResponse] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get('tab') || undefined;

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

  // タブはURLパラメータを優先（リフレッシュ時も保持される）
  const effectiveTab = useMemo(() => {
    // URLパラメータが明示的に指定されている場合は、それを優先
    if (tabParam === 'threads' && hasThreads) return 'threads';
    if (tabParam === 'instagram' && hasInstagram) return 'instagram';

    // URLパラメータがあるが、そのチャンネルがない場合はフォールバック
    if (tabParam === 'threads' && !hasThreads && hasInstagram) return 'instagram';
    if (tabParam === 'instagram' && !hasInstagram && hasThreads) return 'threads';

    // URLパラメータがない場合のデフォルト（Instagramを優先）
    if (!tabParam) {
      if (hasInstagram) return 'instagram';
      if (hasThreads) return 'threads';
    }

    // どちらもない場合
    return 'none';
  }, [tabParam, hasInstagram, hasThreads]);

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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--color-background)]">
      <div className="container mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link href="/" className="inline-block text-sm text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] mb-4">
            ← ホームに戻る
          </Link>

          {/* プロフィールカード（左上） */}
          {(dashboardResponse?.user?.threads_username || dashboardResponse?.user?.instagram_username) && (
            <div className="ui-card p-4 mb-6">
              <div className="flex items-center space-x-4">
                {(() => {
                  // タブに応じてプロフィール画像を選択
                  const profilePictureUrl = effectiveTab === 'instagram'
                    ? (dashboardResponse?.user?.instagram_profile_picture_url || dashboardResponse?.user?.threads_profile_picture_url)
                    : (dashboardResponse?.user?.threads_profile_picture_url || dashboardResponse?.user?.instagram_profile_picture_url);
                  const username = effectiveTab === 'instagram'
                    ? (dashboardResponse?.user?.instagram_username || dashboardResponse?.user?.threads_username)
                    : (dashboardResponse?.user?.threads_username || dashboardResponse?.user?.instagram_username);

                  return profilePictureUrl ? (
                    <img
                      src={profilePictureUrl}
                      alt={username || 'User'}
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-[color:var(--color-accent)] flex items-center justify-center">
                      <span className="text-xl font-bold text-white">
                        {(username || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  );
                })()}
                <div>
                  <h1 className="text-xl font-bold text-[color:var(--color-text-primary)]">
                    {effectiveTab === 'instagram'
                      ? (dashboardResponse?.user?.instagram_username || dashboardResponse?.user?.threads_username)
                      : (dashboardResponse?.user?.threads_username || dashboardResponse?.user?.instagram_username)}
                  </h1>
                  <p className="text-sm text-[color:var(--color-text-secondary)]">
                    @{effectiveTab === 'instagram'
                      ? (dashboardResponse?.user?.instagram_username || dashboardResponse?.user?.threads_username)
                      : (dashboardResponse?.user?.threads_username || dashboardResponse?.user?.instagram_username)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* タブナビゲーション */}
        {(hasInstagram || hasThreads) ? (
          <div className="flex border-b border-[color:var(--color-border)] mb-8">
            {hasInstagram ? (
              <Link
                href={`/${userId}?tab=instagram`}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  effectiveTab === 'instagram'
                    ? 'border-b-2 border-[color:var(--color-accent)] text-[color:var(--color-accent)]'
                    : 'text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]'
                }`}
              >
                Instagram
              </Link>
            ) : null}
            {hasThreads ? (
              <Link
                href={`/${userId}?tab=threads`}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  effectiveTab === 'threads'
                    ? 'border-b-2 border-[color:var(--color-text-primary)] text-[color:var(--color-text-primary)]'
                    : 'text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]'
                }`}
              >
                Threads
              </Link>
            ) : null}
          </div>
        ) : null}

        {/* タブコンテンツ */}
        {effectiveTab === 'instagram' ? (
          <InstagramTab data={dashboardData} />
        ) : effectiveTab === 'threads' ? (
          <ThreadsTab data={dashboardData} />
        ) : (
          <NoChannelMessage />
        )}
      </div>
    </div>
  );
}

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

interface ThreadsComment {
  id: string;
  comment_id: string;
  parent_post_id: string;
  text: string;
  timestamp: string | null;
  permalink: string;
  has_replies: boolean;
  views: number;
  depth: number; // コメント欄の順番（0=コメント欄1, 1=コメント欄2, ...）
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

  // コメントデータ（自分のコメント = 投稿の続き）
  const comments = (data as {threadsComments?: {data: ThreadsComment[]}}).threadsComments?.data || [];

  // 投稿とコメントを結合するマップを作成（parent_post_id = threads_id）
  const commentsByPostId = new Map<string, ThreadsComment[]>();
  comments.forEach((comment) => {
    const postId = comment.parent_post_id;
    if (!commentsByPostId.has(postId)) {
      commentsByPostId.set(postId, []);
    }
    commentsByPostId.get(postId)!.push(comment);
  });

  // 日別メトリクス
  const dailyMetrics = (data as {threadsDailyMetrics?: {data: Array<{date: string; followers_count: number; follower_delta: number; total_views: number; post_count: number}>}}).threadsDailyMetrics?.data || [];
  const latestMetrics = (data as {threadsDailyMetrics?: {latest: {followers_count: number; follower_delta: number} | null}}).threadsDailyMetrics?.latest;
  const followersCount = latestMetrics?.followers_count || 0;

  // エンゲージメント率の計算 (いいね + 返信 + リポスト + 引用) / 閲覧数
  const totalEngagements: number = totalLikes + totalReplies + totalReposts + totalQuotes;
  const engagementRate = totalViews > 0 ? (totalEngagements / totalViews * 100).toFixed(2) : '0.00';

  // ソート処理
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

  // 投稿の全文を取得（本文 + コメントの続き）
  const getFullText = (post: ThreadsPostData): string => {
    const postComments = commentsByPostId.get(post.threads_id) || [];
    if (postComments.length === 0) {
      return post.text || '';
    }

    // depthでソート（コメント欄1, 2, 3...の順番）
    const sortedComments = [...postComments].sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0));

    // コメントを「【コメント欄N】」形式で結合
    const commentParts = sortedComments.map((c, idx) => {
      const label = `【コメント欄${idx + 1}】`;
      return `${label}\n${c.text}`;
    }).filter(Boolean);

    // 投稿本文 + コメント欄
    return [post.text, ...commentParts].filter(Boolean).join('\n\n');
  };

  // 投稿にコメント（続き）があるかどうか
  const hasComments = (post: ThreadsPostData): boolean => {
    return (commentsByPostId.get(post.threads_id)?.length || 0) > 0;
  };

  // 投稿のコメント数を取得
  const getCommentCount = (post: ThreadsPostData): number => {
    return commentsByPostId.get(post.threads_id)?.length || 0;
  };

  // 遷移率を計算（メイン投稿 → コメント欄1 → コメント欄2...）
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

    // depthでソート
    const sortedComments = [...postComments].sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0));

    const transitions: Array<{from: string; to: string; rate: number; views: number}> = [];

    // メイン投稿 → コメント欄1
    if (sortedComments.length > 0) {
      const firstComment = sortedComments[0];
      const rate = (firstComment.views / post.views) * 100;
      transitions.push({
        from: 'メイン',
        to: 'コメント欄1',
        rate,
        views: firstComment.views,
      });
    }

    // コメント欄1 → コメント欄2, コメント欄2 → コメント欄3...
    for (let i = 1; i < sortedComments.length; i++) {
      const prevComment = sortedComments[i - 1];
      const currComment = sortedComments[i];
      if (prevComment.views > 0) {
        const rate = (currComment.views / prevComment.views) * 100;
        transitions.push({
          from: `コメント欄${i}`,
          to: `コメント欄${i + 1}`,
          rate,
          views: currComment.views,
        });
      }
    }

    // メイン→最終コメント欄の全体遷移率
    const lastComment = sortedComments[sortedComments.length - 1];
    const overallRate = post.views > 0 ? (lastComment.views / post.views) * 100 : null;

    return {
      transitions,
      overallRate,
      lastCommentViews: lastComment.views,
    };
  };

  // 表示件数
  const INITIAL_DISPLAY_COUNT = 20;
  const displayedPosts = showAllPosts ? sortedPosts : sortedPosts.slice(0, INITIAL_DISPLAY_COUNT);
  const hasMorePosts = sortedPosts.length > INITIAL_DISPLAY_COUNT;

  // 曜日・時間帯分析
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
      {/* アカウントの概要 - AutoStudio InsightsCard形式 */}
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
            {/* 曜日別 */}
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

            {/* 時間帯別 */}
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
              // 改行が2つ以上あるか、80文字以上、またはコメント（続き）がある場合は折りたたみ対象
              const lineCount = (p.text?.match(/\n/g) || []).length;
              const needsExpand = p.text && (p.text.length > 80 || lineCount >= 2 || postHasComments);

              // 日付表示（無効な日付の場合は「-」を表示）
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

              // 表示するテキスト（展開時は全文、折りたたみ時は本文のみ）
              const displayText = isExpanded ? fullText : (p.text || '(テキストなし)');
              const commentCount = getCommentCount(p);
              const { transitions: transitionRates, overallRate } = getTransitionRates(p);
              const isTop10 = idx < 10;
              const rank = idx + 1;

              return (
                <div
                  key={p.id || idx}
                  className={`rounded-[var(--radius-md)] border bg-white p-3 shadow-[var(--shadow-soft)] cursor-pointer ${
                    isTop10
                      ? 'border-amber-300 bg-amber-50/30'
                      : 'border-[color:var(--color-border)]'
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
                  {/* 遷移率表示（コメントがある場合は常に表示） */}
                  {transitionRates.length > 0 && (
                    <div className="mt-2 rounded-md bg-gradient-to-r from-purple-50 to-indigo-50 p-2 border border-purple-100">
                      <div className="flex items-center gap-1 flex-wrap text-[10px]">
                        {/* メイン投稿 */}
                        <div className="flex flex-col items-center">
                          <span className="text-gray-500">メイン</span>
                          <span className="font-bold text-gray-700">{p.views.toLocaleString()}</span>
                        </div>
                        {transitionRates.map((t, tIdx) => {
                          // 1投稿目から2投稿目（tIdx === 0: メイン→コメント欄1）は10%以上で緑
                          // 2投稿目以降は80%以上で緑
                          const isFirstTransition = tIdx === 0;
                          const colorClass = isFirstTransition
                            ? t.rate >= 10 ? 'text-green-600' : 'text-red-500'
                            : t.rate >= 80 ? 'text-green-600' : t.rate >= 50 ? 'text-yellow-600' : 'text-red-500';

                          return (
                            <div key={tIdx} className="flex items-center gap-1">
                              {/* 矢印と遷移率 */}
                              <div className="flex flex-col items-center px-1">
                                <span className="text-gray-400">→</span>
                                <span className={`font-bold ${colorClass}`}>
                                  {t.rate.toFixed(1)}%
                                </span>
                              </div>
                              {/* 次のステップ */}
                              <div className="flex flex-col items-center">
                                <span className="text-gray-500">{t.to}</span>
                                <span className="font-bold text-gray-700">{t.views.toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* メイン→最終コメント欄の全体遷移率 */}
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
                  {/* Threadsリンク */}
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
          {/* 続きを見るボタン */}
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

function NoChannelMessage() {
  return (
    <div className="ui-card p-8 text-center">
      <h2 className="text-xl font-bold text-[color:var(--color-text-primary)] mb-4">利用可能なデータがありません</h2>
      <p className="text-[color:var(--color-text-secondary)]">
        Instagram または Threads にログインすると、ここでダッシュボードを確認できます。
      </p>
      <Link
        href="/login"
        className="inline-block mt-4 bg-[color:var(--color-accent)] text-white px-6 py-3 rounded-[var(--radius-md)] hover:opacity-90 transition-opacity"
      >
        ログインページへ
      </Link>
    </div>
  );
}

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

  // 期間フィルタリング（Hooksは早期リターンの前に呼ぶ）
  const filteredByRange = useMemo(() => {
    if (dailyMetrics.length === 0) return [];
    if (dateRange === 'all') {
      return dailyMetrics;
    }
    const days = dateRange === '3days' ? 3 : dateRange === '7days' ? 7 : 30;
    // 日付順にソートして最新からN日分を取得
    const sorted = [...dailyMetrics].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return sorted.slice(0, days);
  }, [dailyMetrics, dateRange]);

  // ソート処理
  const sortedMetrics = useMemo(() => {
    return [...filteredByRange].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [filteredByRange, sortOrder]);

  // グラフ用データ（古い順に並べる）
  const chartData = useMemo(() => {
    return [...filteredByRange]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(m => ({
        date: m.date.slice(5), // MM-DD形式
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

  if (dailyMetrics.length === 0) {
    return null;
  }

  return (
    <div className="ui-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">インプレッション & フォロワー推移</h2>
          <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">日別のパフォーマンスを確認できます</p>
        </div>
        {/* 期間フィルター */}
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

      {/* テーブル表示 */}
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

      {/* グラフ表示 */}
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
