'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import LoadingScreen from '@/components/LoadingScreen';
import { PLANS } from '@/lib/univapay/plans';

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
  plan_id: string | null;
  subscription_id: string | null;
  subscription_status: string | null;
  last_login_at: string | null;
  subscription_created_at: string | null;
  trial_ends_at: string | null;
  created_at: string | null;
  total_access_count: number;
  active_days_7d: number;
  utm_source: string | null;
  affiliate_code: string | null;
}

interface GrandprixEntry {
  lineName: string;
  threadsUsername: string;
  hasAnalycaAtEntry: boolean;
  analycaUserIdAtEntry: string | null;
  createdAt: string;
}

type AdminTab = 'users' | 'affiliates' | 'grandprix';

function parseAdminTab(value: string | null): AdminTab {
  if (value === 'affiliates' || value === 'grandprix') {
    return value;
  }

  return 'users';
}

interface SubscriptionInfo {
  next_payment_date: string | null;
  amount: number;
  status: string;
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
  subscriptionMap: Record<string, SubscriptionInfo>;
  fetchedAt: string;
}

// プラン判定
function getPlan(user: AdminUser): string {
  if (user.has_instagram && user.has_threads) return 'Standard';
  return 'Light';
}

function getPlanId(user: AdminUser, ext?: UserExtended): string | null {
  if (ext?.plan_id) return ext.plan_id;
  if (user.has_instagram && user.has_threads) return 'standard';
  if (user.has_threads) return 'light-threads';
  if (user.has_instagram) return 'light-instagram';
  return null;
}

function getPlanLabel(user: AdminUser, ext?: UserExtended): string {
  const sub = ext?.subscription_status;
  const isLead = !sub || sub === 'none';
  if (isLead) return '-';
  const planId = getPlanId(user, ext);
  if (!planId) return '-';
  const plan = PLANS[planId];
  if (!plan) return getPlan(user);
  return plan.yearly ? `${plan.name} 年額` : plan.name;
}

function getPlanAmount(user: AdminUser, ext?: UserExtended): number | null {
  const sub = ext?.subscription_status;
  if (!sub || sub === 'none') return null;
  const planId = getPlanId(user, ext);
  if (!planId) return null;
  return PLANS[planId]?.price ?? null;
}

// アクティブ判定（統計カード用）: 決済済みのみ。SNS連携だけでは active にしない
function isActive(_user: AdminUser, ext?: UserExtended): boolean {
  const subStatus = ext?.subscription_status;
  return subStatus === 'active' || subStatus === 'current';
}

// ステータス判定
type UserStatus = 'active' | 'trial' | 'cancelled' | 'inactive';

function getUserStatus(_user: AdminUser, ext?: UserExtended): UserStatus {
  const subStatus = ext?.subscription_status;
  // 解約を最優先判定（BigQuery側は 'canceled' (l1個) で保存されるケースあり。両スペル対応）
  if (subStatus === 'canceled' || subStatus === 'cancelled' || subStatus === 'expired') return 'cancelled';
  if (subStatus === 'trial') return 'trial';
  if (subStatus === 'active' || subStatus === 'current') return 'active';
  // SNS連携だけで決済してないユーザー (subscription_status='none' or NULL) は未契約扱い
  return 'inactive';
}

function getStatusLabel(status: UserStatus): string {
  switch (status) {
    case 'active': return 'アクティブ';
    case 'trial': return '無料期間';
    case 'cancelled': return '退会';
    case 'inactive': return '未契約';
  }
}

function getStatusStyle(status: UserStatus): string {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-700';
    case 'trial': return 'bg-blue-100 text-blue-700';
    case 'cancelled': return 'bg-red-100 text-red-700';
    case 'inactive': return 'bg-gray-100 text-gray-500';
  }
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

function formatAmount(amount: number | null): string {
  if (amount === null || Number.isNaN(amount)) return '-';
  return `¥${amount.toLocaleString('ja-JP')}`;
}

function AdminPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const passwordFromUrl = searchParams?.get('password') || '';
  const tabFromUrl = parseAdminTab(searchParams?.get('tab') || null);
  const [password, setPassword] = useState('');
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [rewardMonth, setRewardMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [grandprixEntries, setGrandprixEntries] = useState<GrandprixEntry[]>([]);
  const [grandprixLoading, setGrandprixLoading] = useState(false);
  const [grandprixError, setGrandprixError] = useState<string | null>(null);
  const [grandprixFetchedAt, setGrandprixFetchedAt] = useState<string | null>(null);

  const fetchGrandprixEntries = async (pw = password) => {
    setGrandprixLoading(true);
    setGrandprixError(null);

    try {
      const url = pw ? `/api/admin/threads-grandprix/entries?password=${encodeURIComponent(pw)}` : '/api/admin/threads-grandprix/entries';
      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'グランプリ夏のエントリー取得に失敗しました');
      }

      setGrandprixEntries(result.data?.entries || []);
      setGrandprixFetchedAt(result.data?.fetchedAt || new Date().toISOString());
    } catch (err) {
      setGrandprixEntries([]);
      setGrandprixFetchedAt(null);
      setGrandprixError(err instanceof Error ? err.message : 'グランプリ夏のエントリー取得に失敗しました');
    } finally {
      setGrandprixLoading(false);
    }
  };

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

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);

    const params = new URLSearchParams();
    const currentPassword = password || searchParams?.get('password') || '';
    if (currentPassword) params.set('password', currentPassword);
    if (tab !== 'users') params.set('tab', tab);

    const query = params.toString();
    router.replace(query ? `/admin?${query}` : '/admin', { scroll: false });
  };

  useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  useEffect(() => {
    if (passwordFromUrl) {
      setPassword(passwordFromUrl);
      fetchData(passwordFromUrl);
    } else {
      // cookie認証を試行（パスワードなしでAPI呼び出し）
      fetchData('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passwordFromUrl]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'grandprix' && !grandprixFetchedAt) {
      fetchGrandprixEntries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAuthenticated, grandprixFetchedAt]);

  const fetchData = async (pw: string) => {
    setLoading(true);
    setError(null);

    try {
      const url = pw ? `/api/admin?password=${encodeURIComponent(pw)}` : '/api/admin';
      const response = await fetch(url);
      const result = await response.json();

      if (!result.success) {
        // cookie認証失敗時はパスワード入力画面を表示（エラーは出さない）
        if (!pw) {
          setLoading(false);
          return;
        }
        setError(result.error || '認証に失敗しました');
        setIsAuthenticated(false);
      } else {
        setData(result.data);
        setIsAuthenticated(true);
        if (pw && !searchParams?.get('password')) {
          const params = new URLSearchParams();
          params.set('password', pw);
          if (activeTab !== 'users') params.set('tab', activeTab);
          router.replace(`/admin?${params.toString()}`, { scroll: false });
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
  const demoFiltered = data.users.filter(u =>
    u.instagram_username !== 'demo_account' &&
    u.threads_username !== 'demo_account' &&
    u.instagram_username !== 'yoko_gemqueen' &&
    u.threads_username !== 'yoko_gemqueen' &&
    !u.user_id.includes('demo')
  );

  // ユーザー拡張情報のマップ（アクティブ判定で subscription_status を参照するため先に構築）
  const extendedMap = new Map<string, UserExtended>();
  (data.usersExtended || []).forEach(ue => extendedMap.set(ue.user_id, ue));

  // 一覧表示用: 未契約リード（SNS連携だけ）も含める全ユーザー
  const realUsers = demoFiltered;

  // KPI集計用: 契約ユーザーのみ（subscription_status が 'none'/NULL を除外）
  const paidUsers = demoFiltered.filter(u => {
    const sub = extendedMap.get(u.user_id)?.subscription_status;
    return sub && sub !== 'none';
  });

  const activeUsers = paidUsers.filter(u => isActive(u, extendedMap.get(u.user_id)));
  const lightUsers = paidUsers.filter(u => getPlan(u) === 'Light');
  const standardUsers = paidUsers.filter(u => getPlan(u) === 'Standard');

  // UnivaPayサブスクリプション情報
  const subMap = data.subscriptionMap || {};

  // 売上集計から除外するユーザー（工藤さん・山崎さん）
  const excludeUserIds = new Set(['10012809578833342', '25490712063929916']);

  // アフィリエイトデータ
  const affiliates = data.affiliates || [];

  const tabs = [
    { key: 'users' as const, label: 'ユーザー一覧' },
    { key: 'affiliates' as const, label: 'アフィリエイト' },
    { key: 'grandprix' as const, label: 'グランプリ夏' },
  ];

  const usersByThreadsUsername = new Map<string, AdminUser>();
  const usersById = new Map<string, AdminUser>();
  realUsers.forEach((user) => {
    usersById.set(user.user_id, user);

    const username = user.threads_username?.trim().replace(/^@/, '').toLowerCase();
    if (username) {
      usersByThreadsUsername.set(username, user);
    }
  });
  const grandprixUrlIssuedCount = grandprixEntries.filter((entry) =>
    usersByThreadsUsername.has(entry.threadsUsername.trim().replace(/^@/, '').toLowerCase())
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-[1800px] px-4 py-8 xl:px-8">
        {/* タブ */}
        <div className="flex gap-2 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
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
        {activeTab === 'users' && (() => {
          // ステータス別集計（未契約リードも含む全体）
          const statusCounts = { active: 0, trial: 0, cancelled: 0, inactive: 0 };
          realUsers.forEach(u => {
            const ext = extendedMap.get(u.user_id);
            statusCounts[getUserStatus(u, ext)]++;
          });
          const leadCount = statusCounts.inactive;

          // 請求見込み集計（UnivaPayのsubscription.next_payment_dateベース。実入金額ではない）
          const excludeSubIds = new Set<string>();
          excludeUserIds.forEach(uid => {
            const ext = extendedMap.get(uid);
            if (ext?.subscription_id) excludeSubIds.add(ext.subscription_id);
          });

          let confirmedRevenue = 0; // 請求済み推定（次回決済日が来月以降、または今月内で今日以前）
          let projectedRevenue = 0; // 今後請求予定（今月内で今日より後）
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

          paidUsers.forEach(u => {
            if (excludeUserIds.has(u.user_id)) return;
            const ext = extendedMap.get(u.user_id);
            const userStatus = getUserStatus(u, ext);
            if (userStatus === 'cancelled' || userStatus === 'inactive') return;
            const subId = ext?.subscription_id;
            if (!subId) return;
            const sub = subMap[subId];
            if (!sub) return;
            if (sub.status === 'canceled' || sub.status === 'suspended') return;
            if (excludeSubIds.has(subId)) return;

            const nextDate = sub.next_payment_date ? new Date(sub.next_payment_date) : null;
            if (!nextDate) return;

            // 次回決済日が今月内かチェック
            if (nextDate >= monthStart && nextDate <= monthEnd) {
              if (nextDate <= now) {
                confirmedRevenue += sub.amount;
              } else {
                projectedRevenue += sub.amount;
              }
            }
            // 次回決済日が来月 = 今月は既に決済済み
            if (nextDate > monthEnd) {
              confirmedRevenue += sub.amount;
            }
          });

          const totalMonthly = confirmedRevenue + projectedRevenue;

          return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-6">
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <p className="text-sm text-gray-500">当月請求見込み</p>
                <p className="text-2xl font-bold text-gray-800">¥{totalMonthly.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <p className="text-sm text-gray-500">請求済み推定</p>
                <p className="text-2xl font-bold text-green-600">¥{confirmedRevenue.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <p className="text-sm text-gray-500">今後請求予定</p>
                <p className="text-2xl font-bold text-blue-600">¥{projectedRevenue.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <p className="text-sm text-gray-500">アクティブ</p>
                <p className="text-2xl font-bold text-green-600">{statusCounts.active}人</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <p className="text-sm text-gray-500">無料体験</p>
                <p className="text-2xl font-bold text-blue-600">{statusCounts.trial}人</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <p className="text-sm text-gray-500">退会</p>
                <p className="text-2xl font-bold text-red-600">{statusCounts.cancelled}人</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <p className="text-sm text-gray-500">未契約リード</p>
                <p className="text-2xl font-bold text-gray-500">{leadCount}人</p>
              </div>
            </div>
          );
        })()}

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

        {activeTab === 'grandprix' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">エントリー数</p>
              <p className="text-3xl font-bold text-gray-800">{grandprixEntries.length}</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">URL発行済み</p>
              <p className="text-3xl font-bold text-emerald-600">{grandprixUrlIssuedCount}</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">共有URL</p>
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <a
                  href="https://analyca.jp/threads-grandprix/ranking"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-sm font-semibold text-blue-600 hover:text-blue-800"
                >
                  https://analyca.jp/threads-grandprix/ranking
                </a>
                <button
                  type="button"
                  onClick={() => copyToClipboard('https://analyca.jp/threads-grandprix/ranking', 'grandprix-ranking-url')}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white hover:text-gray-900"
                  aria-label="グランプリURLをコピー"
                  title={copied === 'grandprix-ranking-url' ? 'コピー済み' : 'コピー'}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ユーザー一覧タブ */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1660px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="min-w-[180px] px-4 py-3 text-left text-xs font-medium uppercase whitespace-nowrap text-gray-500">ユーザー名</th>
                    <th className="min-w-[90px] px-4 py-3 text-left text-xs font-medium uppercase whitespace-nowrap text-gray-500">プラン</th>
                    <th className="min-w-[140px] px-4 py-3 text-left text-xs font-medium uppercase whitespace-nowrap text-gray-500">連携媒体</th>
                    <th className="min-w-[120px] px-4 py-3 text-left text-xs font-medium uppercase whitespace-nowrap text-gray-500">契約開始</th>
                    <th className="min-w-[110px] px-4 py-3 text-left text-xs font-medium uppercase whitespace-nowrap text-gray-500">ステータス</th>
                    <th className="min-w-[140px] px-4 py-3 text-left text-xs font-medium uppercase whitespace-nowrap text-gray-500">初回決済</th>
                    <th className="min-w-[120px] px-4 py-3 text-left text-xs font-medium uppercase whitespace-nowrap text-gray-500">次回決済</th>
                    <th className="min-w-[120px] px-4 py-3 text-left text-xs font-medium uppercase whitespace-nowrap text-gray-500">決済金額</th>
                    <th className="min-w-[160px] px-4 py-3 text-left text-xs font-medium uppercase whitespace-nowrap text-gray-500">最終ログイン</th>
                    <th className="min-w-[110px] px-4 py-3 text-right text-xs font-medium uppercase whitespace-nowrap text-gray-500">起動回数</th>
                    <th className="min-w-[130px] px-4 py-3 text-left text-xs font-medium uppercase whitespace-nowrap text-gray-500">登録経路</th>
                    <th className="min-w-[300px] px-4 py-3 text-left text-xs font-medium uppercase whitespace-nowrap text-gray-500">通常URL</th>
                    <th className="min-w-[300px] px-4 py-3 text-left text-xs font-medium uppercase whitespace-nowrap text-gray-500">管理URL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {realUsers.map((user) => {
                    const dashboardUrl = `${baseUrl}/${user.user_id}`;
                    const adminDashboardUrl = `${dashboardUrl}/admin`;
                    const ext = extendedMap.get(user.user_id);
                    const plan = getPlanLabel(user, ext);
                    const isExcluded = excludeUserIds.has(user.user_id);
                    const paymentAmount = isExcluded ? null : getPlanAmount(user, ext);
                    const firstPaymentAt = isExcluded ? null : (ext?.subscription_created_at ?? null);
                    const scheduledPaymentAt =
                      !firstPaymentAt && !isExcluded && ext?.subscription_status === 'trial'
                        ? ext.trial_ends_at
                        : null;
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
                        <td className="px-4 py-4">
                          {plan === '-' ? (
                            <span className="text-gray-400 text-sm">-</span>
                          ) : (
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              plan.startsWith('Standard')
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {plan}
                            </span>
                          )}
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
                          {formatDate(ext?.created_at ?? user.created_at ?? null)}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            getStatusStyle(getUserStatus(user, ext))
                          }`}>
                            {getStatusLabel(getUserStatus(user, ext))}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">
                          <div className="font-medium text-gray-800">
                            {formatDate(firstPaymentAt || scheduledPaymentAt)}
                          </div>
                          <div className="text-xs text-gray-400">
                            {firstPaymentAt ? '確定' : scheduledPaymentAt ? '予定' : '-'}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">
                          {(() => {
                            const subId = ext?.subscription_id;
                            const sub = subId ? subMap[subId] : null;
                            return sub?.next_payment_date ? formatDate(sub.next_payment_date) : '-';
                          })()}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">
                          {(() => {
                            const subId = ext?.subscription_id;
                            const sub = subId ? subMap[subId] : null;
                            return sub ? formatAmount(sub.amount) : formatAmount(paymentAmount);
                          })()}
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
                          <div className="flex items-center gap-2">
                            <a
                              href={dashboardUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="max-w-[220px] truncate text-sm text-purple-600 hover:text-purple-800"
                            >
                              {dashboardUrl}
                            </a>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(dashboardUrl, user.user_id)}
                              className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                            >
                              {copied === user.user_id ? 'コピー済み' : 'コピー'}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <a
                              href={adminDashboardUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="max-w-[220px] truncate text-sm text-emerald-700 hover:text-emerald-900"
                            >
                              {adminDashboardUrl}
                            </a>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(adminDashboardUrl, `${user.user_id}-admin`)}
                              className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                            >
                              {copied === `${user.user_id}-admin` ? 'コピー済み' : 'コピー'}
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

        {/* グランプリ夏タブ */}
        {activeTab === 'grandprix' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {grandprixError && (
              <div className="px-6 py-4 border-b border-gray-100">
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{grandprixError}</p>
              </div>
            )}
            {grandprixLoading ? (
              <div className="px-6 py-12 text-center text-gray-400">読み込み中...</div>
            ) : grandprixEntries.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400">エントリーはまだありません</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">LINE名</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Threads ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">登録日時</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">アナリカ契約</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ユーザーURL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {grandprixEntries.map((entry) => {
                      const matchedUser = usersByThreadsUsername.get(entry.threadsUsername.trim().replace(/^@/, '').toLowerCase());
                      const userUrl = matchedUser ? `${baseUrl}/${matchedUser.user_id}` : '';
                      const hasAnalycaAtEntry = entry.hasAnalycaAtEntry;

                      return (
                        <tr key={entry.threadsUsername} className="hover:bg-gray-50">
                          <td className="px-4 py-4 text-sm font-medium text-gray-800 whitespace-nowrap">{entry.lineName}</td>
                          <td className="px-4 py-4 text-sm whitespace-nowrap">
                            <a
                              href={`https://www.threads.net/@${entry.threadsUsername}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-blue-600 hover:text-blue-800"
                            >
                              @{entry.threadsUsername}
                            </a>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">{formatDateTime(entry.createdAt)}</td>
                          <td className="px-4 py-4 text-sm font-bold whitespace-nowrap">
                            <span className={hasAnalycaAtEntry ? 'text-emerald-600' : 'text-red-500'}>
                              {hasAnalycaAtEntry ? '○' : '×'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm whitespace-nowrap">
                            {matchedUser ? (
                              <a
                                href={userUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                              >
                                {userUrl}
                              </a>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
		                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SNS ID</th>
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
		                    {affiliates.map((af) => {
                          const affiliateUser = usersById.get(af.user_id);
                          const snsId = affiliateUser?.threads_username || affiliateUser?.instagram_username || '';

                          return (
		                      <tr key={af.affiliate_code} className="hover:bg-gray-50">
		                        <td className="px-4 py-4">
		                          {snsId ? (
		                            <a
		                              href={`${baseUrl}/${af.user_id}`}
		                              target="_blank"
		                              rel="noopener noreferrer"
		                              className="font-mono text-sm font-semibold text-blue-600 hover:text-blue-800"
		                            >
		                              @{snsId}
		                            </a>
		                          ) : (
		                            <span className="text-sm text-gray-400">-</span>
		                          )}
		                        </td>
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
                          );
                        })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

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
