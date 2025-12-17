'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import LoadingScreen from '@/components/LoadingScreen';

interface AdminUser {
  user_id: string;
  instagram_username: string | null;
  threads_username: string | null;
  has_instagram: boolean;
  has_threads: boolean;
  created_at: string | null;
}

interface AdminData {
  users: AdminUser[];
  stats: {
    total_users: number;
    instagram_users: number;
    threads_users: number;
  };
  fetchedAt: string;
}

// プラン判定（とりあえず全員Lightプラン）
function getPlan(user: AdminUser): string {
  if (user.has_instagram && user.has_threads) return 'Standard';
  return 'Light';
}

// アクティブ判定（連携があればアクティブ）
function isActive(user: AdminUser): boolean {
  return user.has_instagram || user.has_threads;
}

function AdminPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const pwFromUrl = searchParams?.get('password');
    if (pwFromUrl) {
      setPassword(pwFromUrl);
      fetchData(pwFromUrl);
    }
  }, [searchParams]);

  const fetchData = async (pw: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin?password=${encodeURIComponent(pw)}`);
      const result = await response.json();

      if (!result.success) {
        setError(result.error || '認証に失敗しました');
        setIsAuthenticated(false);
      } else {
        setData(result.data);
        setIsAuthenticated(true);
        if (!searchParams?.get('password')) {
          router.replace(`/admin?password=${encodeURIComponent(pw)}`, { scroll: false });
        }
      }
    } catch {
      setError('データの取得に失敗しました');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      fetchData(password.trim());
    }
  };

  const copyToClipboard = (url: string, userId: string) => {
    navigator.clipboard.writeText(url);
    setCopied(userId);
    setTimeout(() => setCopied(null), 2000);
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // 認証前
  if (!isAuthenticated && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold text-gray-800 text-center mb-6">ANALYCA 管理画面</h1>
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            <button
              type="submit"
              disabled={!password.trim()}
              className="w-full mt-4 px-4 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              ログイン
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingScreen message="読み込み中" />;
  }

  if (!data) {
    return <LoadingScreen message="データ取得中" />;
  }

  const activeUsers = data.users.filter(isActive);
  const lightUsers = data.users.filter(u => getPlan(u) === 'Light');
  const standardUsers = data.users.filter(u => getPlan(u) === 'Standard');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-800">ANALYCA 管理画面</h1>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* サマリーカード */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">総契約数</p>
            <p className="text-3xl font-bold text-gray-800">{data.stats.total_users}</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">アクティブ</p>
            <p className="text-3xl font-bold text-green-600">{activeUsers.length}</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Lightプラン</p>
            <p className="text-3xl font-bold text-blue-600">{lightUsers.length}</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Standardプラン</p>
            <p className="text-3xl font-bold text-purple-600">{standardUsers.length}</p>
          </div>
        </div>

        {/* ユーザー一覧 */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">契約ユーザー一覧</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ユーザー名</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">プラン</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">連携媒体</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ダッシュボードURL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.users.map((user) => {
                  const dashboardUrl = `${baseUrl}/${user.user_id}`;
                  const plan = getPlan(user);
                  const active = isActive(user);

                  return (
                    <tr key={user.user_id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <p className="font-medium text-gray-800">
                          {user.instagram_username || user.threads_username || '-'}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          plan === 'Standard'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {plan}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-1">
                          {user.has_instagram && (
                            <span className="px-2 py-1 bg-pink-100 text-pink-700 text-xs rounded">Instagram</span>
                          )}
                          {user.has_threads && (
                            <span className="px-2 py-1 bg-gray-800 text-white text-xs rounded">Threads</span>
                          )}
                          {!user.has_instagram && !user.has_threads && (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {active ? 'アクティブ' : '未連携'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <a
                            href={dashboardUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-600 hover:text-purple-800 text-sm truncate max-w-[200px]"
                          >
                            {dashboardUrl}
                          </a>
                          <button
                            onClick={() => copyToClipboard(dashboardUrl, user.user_id)}
                            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                          >
                            {copied === user.user_id ? '✓' : 'コピー'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
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
