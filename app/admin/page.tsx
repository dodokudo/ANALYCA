'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import LoadingScreen from '@/components/LoadingScreen';

interface AdminUserSummary {
  user_id: string;
  instagram_username: string | null;
  instagram_profile_picture_url: string | null;
  threads_username: string | null;
  threads_profile_picture_url: string | null;
  has_instagram: boolean;
  has_threads: boolean;
  created_at: string | null;
  ig_followers: number;
  ig_reels_count: number;
  ig_total_views: number;
  threads_followers: number;
  threads_posts_count: number;
  threads_total_views: number;
}

interface AdminOverallStats {
  total_users: number;
  instagram_users: number;
  threads_users: number;
  total_ig_reels: number;
  total_ig_views: number;
  total_threads_posts: number;
  total_threads_views: number;
}

interface AdminData {
  users: AdminUserSummary[];
  stats: AdminOverallStats;
  fetchedAt: string;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function AdminPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [adminKey, setAdminKey] = useState('');
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // URLからキーを取得して自動認証
  useEffect(() => {
    const keyFromUrl = searchParams?.get('key');
    if (keyFromUrl) {
      setAdminKey(keyFromUrl);
      fetchData(keyFromUrl);
    }
  }, [searchParams]);

  const fetchData = async (key: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin?key=${encodeURIComponent(key)}`);
      const result = await response.json();

      if (!result.success) {
        setError(result.error || '認証に失敗しました');
        setIsAuthenticated(false);
      } else {
        setData(result.data);
        setIsAuthenticated(true);
        // URLにキーがなければ追加
        if (!searchParams?.get('key')) {
          router.replace(`/admin?key=${encodeURIComponent(key)}`, { scroll: false });
        }
      }
    } catch (err) {
      setError('データの取得に失敗しました');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminKey.trim()) {
      fetchData(adminKey.trim());
    }
  };

  // 認証前の画面
  if (!isAuthenticated && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">ANALYCA Admin</h1>
            <p className="text-gray-500 mt-1">管理者認証</p>
          </div>

          <form onSubmit={handleSubmit}>
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="管理者キーを入力"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
            {error && (
              <p className="text-red-500 text-sm mt-2">{error}</p>
            )}
            <button
              type="submit"
              disabled={!adminKey.trim()}
              className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-purple-500 to-emerald-400 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              ログイン
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingScreen message="管理者データを読み込み中" />;
  }

  if (!data) {
    return <LoadingScreen message="データを読み込み中" />;
  }

  const { users, stats } = data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-emerald-50">
      {/* ヘッダー */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-emerald-400 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">ANALYCA Admin</h1>
              <p className="text-xs text-gray-500">管理者ダッシュボード</p>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            最終更新: {new Date(data.fetchedAt).toLocaleString('ja-JP')}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 全体統計 */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          <StatCard label="総ユーザー" value={stats.total_users} />
          <StatCard label="Instagram連携" value={stats.instagram_users} />
          <StatCard label="Threads連携" value={stats.threads_users} />
          <StatCard label="総リール数" value={stats.total_ig_reels} />
          <StatCard label="総IG再生数" value={formatNumber(stats.total_ig_views)} />
          <StatCard label="総投稿数" value={stats.total_threads_posts} />
          <StatCard label="総TH再生数" value={formatNumber(stats.total_threads_views)} />
        </div>

        {/* ユーザー一覧 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">ユーザー一覧 ({users.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ユーザー</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">チャンネル</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">IGフォロワー</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">リール数</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">IG再生数</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">THフォロワー</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">投稿数</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">TH再生数</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.user_id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {(user.instagram_profile_picture_url || user.threads_profile_picture_url) ? (
                          <img
                            src={user.instagram_profile_picture_url || user.threads_profile_picture_url || ''}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-emerald-400 flex items-center justify-center text-white font-bold">
                            {(user.instagram_username || user.threads_username || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-800">
                            {user.instagram_username || user.threads_username || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {user.user_id.slice(0, 8)}...
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-1">
                        {user.has_instagram && (
                          <span className="px-2 py-1 bg-pink-100 text-pink-700 text-xs rounded-full">IG</span>
                        )}
                        {user.has_threads && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">TH</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right text-gray-800">
                      {user.ig_followers > 0 ? formatNumber(user.ig_followers) : '-'}
                    </td>
                    <td className="px-4 py-4 text-right text-gray-800">
                      {user.ig_reels_count > 0 ? user.ig_reels_count : '-'}
                    </td>
                    <td className="px-4 py-4 text-right text-gray-800">
                      {user.ig_total_views > 0 ? formatNumber(user.ig_total_views) : '-'}
                    </td>
                    <td className="px-4 py-4 text-right text-gray-800">
                      {user.threads_followers > 0 ? formatNumber(user.threads_followers) : '-'}
                    </td>
                    <td className="px-4 py-4 text-right text-gray-800">
                      {user.threads_posts_count > 0 ? user.threads_posts_count : '-'}
                    </td>
                    <td className="px-4 py-4 text-right text-gray-800">
                      {user.threads_total_views > 0 ? formatNumber(user.threads_total_views) : '-'}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Link
                        href={`/${user.user_id}`}
                        className="px-3 py-1.5 bg-purple-100 text-purple-700 text-sm rounded-lg hover:bg-purple-200 transition-colors"
                      >
                        詳細
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<LoadingScreen message="読み込み中" />}>
      <AdminPageContent />
    </Suspense>
  );
}
