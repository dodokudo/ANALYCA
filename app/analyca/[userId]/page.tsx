'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

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
  channels?: {
    instagram: boolean;
    threads: boolean;
  };
  error?: string;
}

export default function UserDashboardPage({ params }: { params: { userId: string } }) {
  const userId = params.userId;
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

  const effectiveTab = (() => {
    if (tabParam === 'threads') {
      if (hasThreads) return 'threads';
      if (hasInstagram) return 'instagram';
      return 'none';
    }

    if (tabParam === 'instagram' || !tabParam) {
      if (hasInstagram) return 'instagram';
      if (hasThreads) return 'threads';
      return 'none';
    }

    if (hasInstagram) return 'instagram';
    if (hasThreads) return 'threads';
    return 'none';
  })();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (dashboardResponse?.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-emerald-50 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h3 className="text-red-800 font-semibold">エラー</h3>
            <p className="text-red-600 mt-2">{dashboardResponse.error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-emerald-50">
      <div className="container mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link href="/" className="inline-block text-sm text-gray-600 hover:text-gray-900 mb-4">
            ← ホームに戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">ダッシュボード</h1>
          <p className="text-gray-600 mt-2">ユーザーID: {userId}</p>
        </div>

        {/* タブナビゲーション */}
        {(hasInstagram || hasThreads) ? (
          <div className="flex border-b border-gray-200 mb-8">
            {hasInstagram ? (
              <Link
                href={`/analyca/${userId}?tab=instagram`}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  effectiveTab === 'instagram'
                    ? 'border-b-2 border-purple-600 text-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Instagram
              </Link>
            ) : null}
            {hasThreads ? (
              <Link
                href={`/analyca/${userId}?tab=threads`}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  effectiveTab === 'threads'
                    ? 'border-b-2 border-gray-900 text-gray-900'
                    : 'text-gray-600 hover:text-gray-900'
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

function ThreadsTab({ data }: { data?: unknown }) {
  if (!data || !(data as {threads?: unknown}).threads) {
    return (
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Threadsデータがありません</h2>
        <p className="text-gray-600">Threadsでログインしてデータを取得してください。</p>
        <Link
          href="/login"
          className="inline-block mt-4 bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-black"
        >
          ログインページへ
        </Link>
      </div>
    );
  }

  const posts = (data as {threads: {data: unknown[]}}).threads.data || [];
  const totalPosts = (data as {threads: {total: number}}).threads.total || 0;
  const totalViews = (data as {threads: {totalViews: number}}).threads.totalViews || 0;
  const totalLikes = (data as {threads: {totalLikes: number}}).threads.totalLikes || 0;
  const totalReplies = (data as {threads: {totalReplies: number}}).threads.totalReplies || 0;

  const topPosts = [...posts].sort((a: unknown, b: unknown) => ((b as {views?: number}).views || 0) - ((a as {views?: number}).views || 0)).slice(0, 10);

  return (
    <div className="space-y-6">
      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <div className="text-sm font-medium text-gray-600 uppercase">投稿数</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{totalPosts}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <div className="text-sm font-medium text-gray-600 uppercase">総閲覧数</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{totalViews.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <div className="text-sm font-medium text-gray-600 uppercase">総いいね</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{totalLikes.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <div className="text-sm font-medium text-gray-600 uppercase">総返信</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{totalReplies.toLocaleString()}</div>
        </div>
      </div>

      {/* トップコンテンツ */}
      {topPosts.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">トップコンテンツ</h2>
          <p className="text-sm text-gray-600 mb-6">閲覧数の多い投稿</p>
          <div className="space-y-4">
            {topPosts.map((post: unknown, idx: number) => {
              const p = post as {id: string; timestamp: string; views: number; likes: number; replies: number; text: string; permalink?: string};
              return (
                <div key={p.id || idx} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-xs text-gray-500">
                      {new Date(p.timestamp).toLocaleString('ja-JP')}
                    </div>
                    <div className="flex gap-4 text-xs text-gray-600">
                      <span>👁️ {p.views.toLocaleString()}</span>
                      <span>❤️ {p.likes.toLocaleString()}</span>
                      <span>💬 {p.replies.toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap line-clamp-3">{p.text}</p>
                  {p.permalink && (
                    <a
                      href={p.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-2 inline-block"
                    >
                      Threadsで見る →
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function NoChannelMessage() {
  return (
    <div className="bg-white rounded-xl shadow p-8 text-center">
      <h2 className="text-xl font-bold text-gray-900 mb-4">利用可能なデータがありません</h2>
      <p className="text-gray-600">
        Instagram または Threads にログインすると、ここでダッシュボードを確認できます。
      </p>
      <Link
        href="/login"
        className="inline-block mt-4 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700"
      >
        ログインページへ
      </Link>
    </div>
  );
}
