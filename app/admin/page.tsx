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

interface AffiliateRow {
  user_id: string;
  affiliate_code: string;
  commission_rate: number;
  total_referrals: number;
  total_commission: number;
  created_at: string | null;
  total_clicks: number;
  conversion_rate: number;
}

interface ConversionFunnel {
  total_conversions: number;
  total_revenue: number;
  affiliate_sources: number;
  utm_tracked: number;
}

interface UserExtended {
  user_id: string;
  email: string | null;
  last_login_at: string | null;
  subscription_created_at: string | null;
  created_at: string | null;
  total_access_count: number;
  active_days_7d: number;
  utm_source: string | null;
  affiliate_code: string | null;
}

interface AdminData {
  users: AdminUser[];
  stats: {
    total_users: number;
    instagram_users: number;
    threads_users: number;
  };
  affiliates: AffiliateRow[];
  funnel: ConversionFunnel;
  usersExtended: UserExtended[];
  fetchedAt: string;
}

// プラン判定
function getPlan(user: AdminUser): string {
  if (user.has_instagram && user.has_threads) return 'Standard';
  return 'Light';
}

// アクティブ判定
function isActive(user: AdminUser): boolean {
  return user.has_instagram || user.has_threads;
}

// 相対時間表示
function relativeTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'たった今';
    if (diffMin < 60) return `${diffMin}分前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}時間前`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay}日前`;
    const diffMonth = Math.floor(diffDay / 30);
    return `${diffMonth}ヶ月前`;
  } catch {
    return '-';
  }
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return '-';
  }
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
  const [activeTab, setActiveTab] = useState<'users' | 'affiliates' | 'conversions'>('users');
  const [rewardMonth, setRewardMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const handleRewardAction = async (action: 'confirm_rewards' | 'mark_paid', affiliateCode: string) => {
    const key = `${action}-${affiliateCode}`;
    setActionLoading(key);
    setActionMessage(null);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action, affiliateCode, month: rewardMonth }),
      });
      const result = await res.json();
      if (result.success) {
        setActionMessage(result.message);
      } else {
        setActionMessage(`Error: ${result.error}`);
      }
    } catch {
      setActionMessage('Request failed');
    } finally {
      setActionLoading(null);
    }
  };

  const getPrevMonth = () => {
    const [y, m] = rewardMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

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

  // デモアカウントを除外した実ユーザー
  const realUsers = data.users.filter(u =>
    u.instagram_username !== 'demo_account' &&
    u.threads_username !== 'demo_account' &&
    u.instagram_username !== 'yoko_gemqueen' &&
    u.threads_username !== 'yoko_gemqueen' &&
    !u.user_id.includes('demo')
  );
  const activeUsers = realUsers.filter(isActive);
  const lightUsers = realUsers.filter(u => getPlan(u) === 'Light');
  const standardUsers = realUsers.filter(u => getPlan(u) === 'Standard');

  // ユーザー拡張情報のマップ
  const extendedMap = new Map<string, UserExtended>();
  (data.usersExtended || []).forEach(ue => extendedMap.set(ue.user_id, ue));

  // アフィリエイトデータ
  const affiliates = data.affiliates || [];
  const funnel = data.funnel || { total_conversions: 0, total_revenue: 0, affiliate_sources: 0, utm_tracked: 0 };

  const tabs = [
    { key: 'users' as const, label: 'ユーザー一覧' },
    { key: 'affiliates' as const, label: 'アフィリエイト' },
    { key: 'conversions' as const, label: 'コンバージョン' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-[1800px] px-4 py-8 xl:px-8">
        {/* タブ */}
        <div className="flex gap-2 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* タブ別サマリーカード */}
        {activeTab === 'users' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">総契約数</p>
              <p className="text-3xl font-bold text-gray-800">{realUsers.length}</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">アクティブ</p>
              <p className="text-3xl font-bold text-green-600">{activeUsers.length}</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">Lightプラン</p>
              <p className="text-3xl font-bold text-gray-800">{lightUsers.length}</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">Standardプラン</p>
              <p className="text-3xl font-bold text-gray-800">{standardUsers.length}</p>
            </div>
          </div>
        )}

        {activeTab === 'affiliates' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">アフィリエイター数</p>
              <p className="text-3xl font-bold text-gray-800">{affiliates.length}</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">今月の紹介件数</p>
              <p className="text-3xl font-bold text-purple-600">{affiliates.reduce((s, a) => s + a.total_referrals, 0)}</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">今月のアフィリエイト報酬</p>
              <p className="text-3xl font-bold text-emerald-600">{affiliates.reduce((s, a) => s + a.total_commission, 0).toLocaleString()}円</p>
            </div>
          </div>
        )}

        {activeTab === 'conversions' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">総決済数</p>
              <p className="text-3xl font-bold text-gray-800">{funnel.total_conversions}</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">総売上</p>
              <p className="text-3xl font-bold text-purple-600">{funnel.total_revenue.toLocaleString()}円</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">アフィリエイト経由</p>
              <p className="text-3xl font-bold text-blue-600">{funnel.affiliate_sources}</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">UTM追跡済み</p>
              <p className="text-3xl font-bold text-blue-600">{funnel.utm_tracked}</p>
            </div>
          </div>
        )}

        {/* ユーザー一覧タブ */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">契約ユーザー一覧</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="min-w-[180px] px-4 py-3 text-left text-xs font-medium uppercase whitespace-nowrap text-gray-500">ユーザー名</th>
                    <th className="min-w-[200px] px-4 py-3 text-left text-xs font-medium uppercase whitespace-nowrap text-gray-500">メール</th>
                    <th className="min-w-[90px] px-4 py-3 text-left text-xs font-medium uppercase whitespace-nowrap text-gray-500">プラン</th>
                    <th className="min-w-[140px] px-4 py-3 text-left text-xs font-medium uppercase whitespace-nowrap text-gray-500">連携媒体</th>
                    <th className="min-w-[120px] px-4 py-3 text-left text-xs font-medium uppercase whitespace-nowrap text-gray-500">契約開始</th>
                    <th className="min-w-[120px] px-4 py-3 text-left text-xs font-medium uppercase whitespace-nowrap text-gray-500">作成日</th>
                    <th className="min-w-[160px] px-4 py-3 text-left text-xs font-medium uppercase whitespace-nowrap text-gray-500">最終ログイン</th>
                    <th className="min-w-[110px] px-4 py-3 text-right text-xs font-medium uppercase whitespace-nowrap text-gray-500">起動回数</th>
                    <th className="min-w-[130px] px-4 py-3 text-left text-xs font-medium uppercase whitespace-nowrap text-gray-500">登録経路</th>
                    <th className="min-w-[110px] px-4 py-3 text-left text-xs font-medium uppercase whitespace-nowrap text-gray-500">ステータス</th>
                    <th className="min-w-[280px] px-4 py-3 text-left text-xs font-medium uppercase whitespace-nowrap text-gray-500">ダッシュボードURL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {realUsers.map((user) => {
                    const dashboardUrl = `${baseUrl}/${user.user_id}`;
                    const plan = getPlan(user);
                    const active = isActive(user);
                    const ext = extendedMap.get(user.user_id);
                    const source = ext?.affiliate_code
                      ? `AF: ${ext.affiliate_code}`
                      : ext?.utm_source
                        ? `UTM: ${ext.utm_source}`
                        : '-';

                    return (
                      <tr key={user.user_id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <p className="whitespace-nowrap font-medium text-gray-800">
                            {user.instagram_username || user.threads_username || '-'}
                          </p>
                        </td>
                        <td className="max-w-[200px] px-4 py-4 text-sm text-gray-600 truncate whitespace-nowrap">
                          {ext?.email || '-'}
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
                          <div className="flex gap-1 whitespace-nowrap">
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
                        <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">
                          {formatDate(ext?.subscription_created_at ?? null)}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">
                          {formatDate(ext?.created_at ?? user.created_at ?? null)}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">
                          <div className="font-medium text-gray-800">
                            {relativeTime(ext?.last_login_at ?? null)}
                          </div>
                          <div className="text-xs text-gray-400">
                            {formatDateTime(ext?.last_login_at ?? null)}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right text-sm text-gray-700 whitespace-nowrap">
                          <div className="font-semibold text-gray-800">
                            {(ext?.total_access_count ?? 0).toLocaleString('ja-JP')}
                          </div>
                          <div className="text-xs text-gray-400">
                            直近7日 {ext?.active_days_7d ?? 0}日
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`text-xs font-medium ${
                            ext?.affiliate_code ? 'text-emerald-700' : ext?.utm_source ? 'text-blue-700' : 'text-gray-400'
                          }`}>
                            {source}
                          </span>
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
                              className="max-w-[240px] truncate text-sm text-purple-600 hover:text-purple-800"
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
        )}

        {/* アフィリエイト一覧タブ */}
        {activeTab === 'affiliates' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">アフィリエイト一覧</h2>
                  <p className="text-sm text-gray-500 mt-1">全アフィリエイターの成績</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-500">対象月:</label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setRewardMonth(getPrevMonth())}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        rewardMonth === getPrevMonth()
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      前月
                    </button>
                    <button
                      onClick={() => {
                        const now = new Date();
                        setRewardMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
                      }}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        rewardMonth !== getPrevMonth()
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      当月
                    </button>
                  </div>
                  <span className="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">{rewardMonth}</span>
                </div>
              </div>
              {actionMessage && (
                <div className={`mt-2 text-sm px-3 py-2 rounded ${
                  actionMessage.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                }`}>
                  {actionMessage}
                </div>
              )}
            </div>
            {affiliates.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400">
                アフィリエイトデータがありません
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">コード</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">クリック数</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">紹介数</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">転換率</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">報酬率</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">累計コミッション</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">報酬管理</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {affiliates.map((af) => (
                      <tr key={af.affiliate_code} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <span className="font-mono text-sm text-gray-800 bg-gray-100 px-2 py-1 rounded">{af.affiliate_code}</span>
                        </td>
                        <td className="px-4 py-4 text-right text-sm text-gray-700">{af.total_clicks.toLocaleString()}</td>
                        <td className="px-4 py-4 text-right text-sm text-gray-700">{af.total_referrals}</td>
                        <td className="px-4 py-4 text-right text-sm text-gray-700">{af.conversion_rate}%</td>
                        <td className="px-4 py-4 text-right text-sm text-gray-700">{(af.commission_rate * 100).toFixed(0)}%</td>
                        <td className="px-4 py-4 text-right text-sm font-medium text-gray-900">{af.total_commission.toLocaleString()}円</td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => handleRewardAction('confirm_rewards', af.affiliate_code)}
                              disabled={actionLoading === `confirm_rewards-${af.affiliate_code}`}
                              className="px-2 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded transition-colors disabled:opacity-50"
                            >
                              {actionLoading === `confirm_rewards-${af.affiliate_code}` ? '...' : '報酬確定'}
                            </button>
                            <button
                              onClick={() => handleRewardAction('mark_paid', af.affiliate_code)}
                              disabled={actionLoading === `mark_paid-${af.affiliate_code}`}
                              className="px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded transition-colors disabled:opacity-50"
                            >
                              {actionLoading === `mark_paid-${af.affiliate_code}` ? '...' : '振込済み'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* コンバージョン詳細（サマリーカードは上部で表示済み） */}
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
