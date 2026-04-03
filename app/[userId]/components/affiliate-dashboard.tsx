'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';

// ============ DatePreset (page.tsxと同じロジックを複製) ============
type DatePreset = '3d' | '7d' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth';

const datePresetOptions: { value: DatePreset; label: string }[] = [
  { value: '3d', label: '過去3日' },
  { value: '7d', label: '過去7日' },
  { value: 'thisWeek', label: '今週' },
  { value: 'lastWeek', label: '先週' },
  { value: 'thisMonth', label: '今月' },
  { value: 'lastMonth', label: '先月' },
];

function getDateRange(preset: DatePreset, options: { includeToday?: boolean } = {}): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const includeToday = options.includeToday !== false;
  const baseDate = new Date(today);
  if (!includeToday) {
    baseDate.setDate(baseDate.getDate() - 1);
  }
  const end = new Date(baseDate);
  end.setHours(23, 59, 59, 999);

  switch (preset) {
    case '3d': {
      const start = new Date(baseDate);
      start.setDate(start.getDate() - 2);
      return { start, end };
    }
    case '7d': {
      const start = new Date(baseDate);
      start.setDate(start.getDate() - 6);
      return { start, end };
    }
    case 'thisWeek': {
      const dayOfWeek = baseDate.getDay();
      const start = new Date(baseDate);
      start.setDate(start.getDate() - dayOfWeek);
      return { start, end };
    }
    case 'lastWeek': {
      const dayOfWeek = baseDate.getDay();
      const start = new Date(baseDate);
      start.setDate(start.getDate() - dayOfWeek - 7);
      const endOfLastWeek = new Date(start);
      endOfLastWeek.setDate(endOfLastWeek.getDate() + 6);
      endOfLastWeek.setHours(23, 59, 59, 999);
      return { start, end: endOfLastWeek };
    }
    case 'thisMonth': {
      const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
      return { start, end };
    }
    case 'lastMonth': {
      const start = new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1);
      const endOfLastMonth = new Date(baseDate.getFullYear(), baseDate.getMonth(), 0);
      endOfLastMonth.setHours(23, 59, 59, 999);
      return { start, end: endOfLastMonth };
    }
    default:
      return { start: new Date(0), end };
  }
}

function isDateInRange(dateStr: string | null | undefined, range: { start: Date; end: Date }): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  return date >= range.start && date <= range.end;
}

// ============ 型定義 ============
interface AffiliateDashboardProps {
  userId: string;
  initialData?: AffiliateDashboardResponse | null;
}

interface Referral {
  id: string;
  plan_id: string;
  payment_amount: number;
  commission_amount: number;
  status: string;
  created_at: string;
}

interface DailyStat {
  date: string;
  clicks: number;
}

interface PlanBreakdownItem {
  plan_id: string;
  count: number;
  revenue: number;
}

interface BankAccount {
  bank_name: string;
  branch_name: string;
  account_type: 'ordinary' | 'checking';
  account_number: string;
  account_holder: string;
  has_invoice: boolean;
  invoice_number: string;
}

export interface AffiliateDashboardResponse {
  success: boolean;
  error?: string;
  registered: boolean;
  affiliate_code: string | null;
  total_referrals: number;
  total_commission: number;
  total_clicks?: number;
  conversion_rate?: number;
  referrals?: Referral[];
  daily_stats?: DailyStat[];
  plan_breakdown?: PlanBreakdownItem[];
  bank_account?: BankAccount | null;
  identity_uploaded?: boolean;
}

// ============ ヘルパー ============
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '-';
  }
}

function getStatusLabel(status: string): { text: string; className: string } {
  switch (status) {
    case 'confirmed':
      return { text: '確定', className: 'bg-green-100 text-green-800' };
    case 'paid':
      return { text: '振込済み', className: 'bg-blue-100 text-blue-800' };
    default:
      return { text: '仮確定', className: 'bg-yellow-100 text-yellow-800' };
  }
}

function getPlanLabel(planId: string): string {
  switch (planId) {
    case 'light':
    case 'Light':
      return 'Light';
    case 'standard':
    case 'Standard':
      return 'Standard';
    default:
      return planId || '-';
  }
}

function createEmptyBankForm(): BankAccount {
  return {
    bank_name: '',
    branch_name: '',
    account_type: 'ordinary',
    account_number: '',
    account_holder: '',
    has_invoice: false,
    invoice_number: '',
  };
}

function applyDashboardResponse(
  json: AffiliateDashboardResponse,
  setters: {
    setRegistered: (value: boolean) => void;
    setAffiliateCode: (value: string | null) => void;
    setTotalReferrals: (value: number) => void;
    setTotalCommission: (value: number) => void;
    setTotalClicks: (value: number) => void;
    setConversionRate: (value: number) => void;
    setReferrals: (value: Referral[]) => void;
    setDailyStats: (value: DailyStat[]) => void;
    setPlanBreakdown: (value: PlanBreakdownItem[]) => void;
    setBankForm: (value: BankAccount) => void;
    setBankSaved: (value: boolean) => void;
    setIdentityUploaded: (value: boolean) => void;
  }
) {
  setters.setRegistered(json.registered);
  if (!json.registered) return;
  setters.setAffiliateCode(json.affiliate_code);
  setters.setTotalReferrals(json.total_referrals);
  setters.setTotalCommission(json.total_commission);
  setters.setTotalClicks(json.total_clicks || 0);
  setters.setConversionRate(json.conversion_rate || 0);
  setters.setReferrals(json.referrals || []);
  setters.setDailyStats(json.daily_stats || []);
  setters.setPlanBreakdown(json.plan_breakdown || []);
  if (json.bank_account) {
    setters.setBankForm(json.bank_account);
    setters.setBankSaved(true);
  }
  if (json.identity_uploaded) {
    setters.setIdentityUploaded(true);
  }
}

export default function AffiliateDashboard({ userId, initialData = null }: AffiliateDashboardProps) {
  const [subTab, setSubTab] = useState<'insight' | 'settings'>('insight');
  const [datePreset, setDatePreset] = useState<DatePreset>('thisMonth');
  const [loading, setLoading] = useState(!initialData);
  const [registered, setRegistered] = useState(initialData?.registered || false);
  const [affiliateCode, setAffiliateCode] = useState<string | null>(initialData?.affiliate_code || null);
  const [referrals, setReferrals] = useState<Referral[]>(initialData?.referrals || []);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>(initialData?.daily_stats || []);
  const [planBreakdown, setPlanBreakdown] = useState<PlanBreakdownItem[]>(initialData?.plan_breakdown || []);
  const [totalClicks, setTotalClicks] = useState(initialData?.total_clicks || 0);
  const [totalReferrals, setTotalReferrals] = useState(initialData?.total_referrals || 0);
  const [totalCommission, setTotalCommission] = useState(initialData?.total_commission || 0);
  const [conversionRate, setConversionRate] = useState(initialData?.conversion_rate || 0);
  const [registering, setRegistering] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(
    initialData && !initialData.success ? initialData.error || 'データの取得に失敗しました' : null
  );

  // Bank account form state
  const [bankForm, setBankForm] = useState<BankAccount>(initialData?.bank_account || createEmptyBankForm());
  const [bankSaving, setBankSaving] = useState(false);
  const [bankSaved, setBankSaved] = useState(Boolean(initialData?.bank_account));
  const [bankError, setBankError] = useState<string | null>(null);
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [identityUploading, setIdentityUploading] = useState(false);
  const [identityUploaded, setIdentityUploaded] = useState(Boolean(initialData?.identity_uploaded));

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/affiliate/dashboard?userId=${encodeURIComponent(userId)}`);
      const json = (await res.json()) as AffiliateDashboardResponse;
      if (json.success) {
        applyDashboardResponse(json, {
          setRegistered,
          setAffiliateCode,
          setTotalReferrals,
          setTotalCommission,
          setTotalClicks,
          setConversionRate,
          setReferrals,
          setDailyStats,
          setPlanBreakdown,
          setBankForm,
          setBankSaved,
          setIdentityUploaded,
        });
        setError(null);
      }
    } catch {
      setError('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (initialData) return;
    fetchData();
  }, [fetchData, initialData]);

  useEffect(() => {
    if (!initialData) return;
    if (initialData.success) {
      applyDashboardResponse(initialData, {
        setRegistered,
        setAffiliateCode,
        setTotalReferrals,
        setTotalCommission,
        setTotalClicks,
        setConversionRate,
        setReferrals,
        setDailyStats,
        setPlanBreakdown,
        setBankForm,
        setBankSaved,
        setIdentityUploaded,
      });
      setError(null);
    } else {
      setError(initialData.error || 'データの取得に失敗しました');
    }
    setLoading(false);
  }, [initialData]);

  const handleRegister = async () => {
    setRegistering(true);
    setError(null);
    try {
      const res = await fetch('/api/affiliate/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (json.success) {
        setAffiliateCode(json.affiliate_code);
        setRegistered(true);
      } else {
        setError(json.error || '登録に失敗しました');
      }
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setRegistering(false);
    }
  };

  const handleCopy = async () => {
    if (!affiliateCode) return;
    const url = `https://analyca.jp/?ref=${affiliateCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleBankSave = async () => {
    setBankSaving(true);
    setBankError(null);
    try {
      const res = await fetch('/api/affiliate/bank-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...bankForm }),
      });
      const json = await res.json();
      if (json.success) {
        setBankSaved(true);
      } else {
        setBankError(json.error || '保存に失敗しました');
      }
    } catch {
      setBankError('通信エラーが発生しました');
    } finally {
      setBankSaving(false);
    }
  };

  const handleIdentityUpload = async () => {
    if (!identityFile) return;
    setIdentityUploading(true);
    try {
      const formData = new FormData();
      formData.append('userId', userId);
      formData.append('file', identityFile);
      const res = await fetch('/api/affiliate/identity', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (json.success) {
        setIdentityUploaded(true);
      }
    } catch {
      // silent
    } finally {
      setIdentityUploading(false);
    }
  };

  // datePresetでフィルタした日付範囲
  const dateRange = useMemo(() => getDateRange(datePreset, { includeToday: true }), [datePreset]);

  // 日別パフォーマンス（datePresetでフィルタ）
  const dailyPerformance = useMemo(() => {
    const map = new Map<string, { date: string; clicks: number; freeRegistrations: number; paidConversions: number; commission: number }>();
    for (const stat of dailyStats) {
      if (!isDateInRange(stat.date, dateRange)) continue;
      map.set(stat.date, { date: stat.date, clicks: stat.clicks, freeRegistrations: 0, paidConversions: 0, commission: 0 });
    }
    for (const r of referrals) {
      const dateKey = r.created_at.slice(0, 10);
      if (!isDateInRange(dateKey, dateRange)) continue;
      const existing = map.get(dateKey);
      if (existing) {
        existing.freeRegistrations += 1;
        if (r.status === 'confirmed' || r.status === 'paid') {
          existing.paidConversions += 1;
          existing.commission += r.commission_amount;
        }
      } else {
        map.set(dateKey, {
          date: dateKey,
          clicks: 0,
          freeRegistrations: 1,
          paidConversions: (r.status === 'confirmed' || r.status === 'paid') ? 1 : 0,
          commission: (r.status === 'confirmed' || r.status === 'paid') ? r.commission_amount : 0,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [dailyStats, referrals, dateRange]);

  // KPI指標（datePresetでフィルタ）
  const kpiMetrics = useMemo(() => {
    const filteredClicks = dailyStats
      .filter(d => isDateInRange(d.date, dateRange))
      .reduce((sum, d) => sum + d.clicks, 0);
    const filteredReferrals = referrals.filter(r => isDateInRange(r.created_at.slice(0, 10), dateRange));
    const freeRegistrations = filteredReferrals.length;
    const paidConversions = filteredReferrals.filter(r => r.status === 'confirmed' || r.status === 'paid').length;
    const commission = filteredReferrals
      .filter(r => r.status === 'confirmed' || r.status === 'paid')
      .reduce((sum, r) => sum + r.commission_amount, 0);
    const convRate = filteredClicks > 0 ? Math.round(freeRegistrations / filteredClicks * 1000) / 10 : 0;
    const paidConvRate = freeRegistrations > 0 ? Math.round(paidConversions / freeRegistrations * 1000) / 10 : 0;
    return { filteredClicks, freeRegistrations, paidConversions, convRate, paidConvRate, commission };
  }, [dailyStats, referrals, dateRange]);

  // フィルタ済み紹介実績
  const filteredReferrals = useMemo(() => {
    return referrals.filter(r => isDateInRange(r.created_at.slice(0, 10), dateRange));
  }, [referrals, dateRange]);

  if (loading) {
    return (
      <div className="section-stack">
        <div className="ui-card p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-[color:var(--color-surface-muted)] rounded w-1/4"></div>
            <div className="h-4 bg-[color:var(--color-surface-muted)] rounded w-1/2"></div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-20 bg-[color:var(--color-surface-muted)] rounded-[var(--radius-md)]"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!registered) {
    return (
      <div className="ui-card p-8 max-w-lg mx-auto text-center">
        <div className="w-16 h-16 bg-[color:var(--color-surface-muted)] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[color:var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-[color:var(--color-text-primary)] mb-2">アフィリエイトプログラム</h2>
        <p className="text-sm text-[color:var(--color-text-secondary)] mb-6">
          ANALYCAを紹介して、初回決済額の50%をコミッションとして受け取れます。
        </p>
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-[var(--radius-md)] text-sm">
            {error}
          </div>
        )}
        <button
          onClick={handleRegister}
          disabled={registering}
          className="w-full bg-[color:var(--color-text-primary)] hover:opacity-90 text-white font-semibold py-3 px-6 rounded-[var(--radius-sm)] transition-all disabled:opacity-50"
        >
          {registering ? '登録中...' : '紹介コードを発行する'}
        </button>
      </div>
    );
  }

  return (
    <div className="section-stack pb-20 lg:pb-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-[var(--radius-md)] text-sm">
          {error}
        </div>
      )}

      {/* ヘッダー: サブタブ + 日付選択 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-1 md:w-auto">
          {([
            { key: 'insight', label: 'インサイト' },
            { key: 'settings', label: '設定' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className={`h-10 flex-1 rounded-[var(--radius-sm)] px-6 text-sm font-semibold transition-all md:flex-none md:min-w-[96px] ${
                subTab === key
                  ? 'bg-[color:var(--color-text-primary)] text-white shadow-sm'
                  : 'text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {subTab === 'insight' && (
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as DatePreset)}
            className="h-9 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-text-secondary)]"
          >
            {datePresetOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* ===== インサイトタブ ===== */}
      {subTab === 'insight' && (<>

      {/* 紹介リンク */}
      <div className="ui-card p-6">
        <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)] mb-3">紹介リンク</h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={`https://analyca.jp/?ref=${affiliateCode}`}
            className="flex-1 h-9 px-3 bg-[color:var(--color-surface-muted)] border border-[color:var(--color-border)] rounded-[var(--radius-sm)] text-sm text-[color:var(--color-text-primary)] select-all font-mono"
          />
          <button
            onClick={handleCopy}
            className={`shrink-0 h-9 px-4 rounded-[var(--radius-sm)] text-sm font-medium transition-all ${
              copied
                ? 'bg-[color:var(--color-text-primary)] text-white'
                : 'bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-border)]'
            }`}
          >
            {copied ? 'コピー済み' : 'コピー'}
          </button>
        </div>
        <p className="text-xs text-[color:var(--color-text-muted)] mt-2">コード: {affiliateCode}</p>
      </div>

      {/* KPIカード */}
      <div className="ui-card p-4 md:p-6">
        <h2 className="text-base md:text-lg font-semibold text-[color:var(--color-text-primary)] mb-3 md:mb-6">パフォーマンス指標</h2>
        <dl className="grid min-w-0 grid-cols-6 gap-1.5 md:gap-4">
          <div className="min-w-0 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-2 md:p-4">
            <dt className="truncate text-[9px] md:text-xs font-medium text-[color:var(--color-text-secondary)]">クリック</dt>
            <dd className="mt-1 md:mt-2 truncate text-sm md:text-2xl font-semibold text-[color:var(--color-text-primary)]">{kpiMetrics.filteredClicks}</dd>
          </div>
          <div className="min-w-0 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-2 md:p-4">
            <dt className="truncate text-[9px] md:text-xs font-medium text-[color:var(--color-text-secondary)]">無料登録</dt>
            <dd className="mt-1 md:mt-2 truncate text-sm md:text-2xl font-semibold text-[color:var(--color-text-primary)]">{kpiMetrics.freeRegistrations}</dd>
          </div>
          <div className="min-w-0 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-2 md:p-4">
            <dt className="truncate text-[9px] md:text-xs font-medium text-[color:var(--color-text-secondary)]">有料転換</dt>
            <dd className="mt-1 md:mt-2 truncate text-sm md:text-2xl font-semibold text-[color:var(--color-text-primary)]">{kpiMetrics.paidConversions}</dd>
          </div>
          <div className="min-w-0 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-2 md:p-4">
            <dt className="truncate text-[9px] md:text-xs font-medium text-[color:var(--color-text-secondary)]">転換率</dt>
            <dd className="mt-1 md:mt-2 truncate text-sm md:text-2xl font-semibold text-[color:var(--color-text-primary)]">{kpiMetrics.convRate}%</dd>
          </div>
          <div className="min-w-0 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-2 md:p-4">
            <dt className="truncate text-[9px] md:text-xs font-medium text-[color:var(--color-text-secondary)]">有料率</dt>
            <dd className="mt-1 md:mt-2 truncate text-sm md:text-2xl font-semibold text-[color:var(--color-text-primary)]">{kpiMetrics.paidConvRate}%</dd>
          </div>
          <div className="min-w-0 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-2 md:p-4">
            <dt className="truncate text-[9px] md:text-xs font-medium text-[color:var(--color-text-secondary)]">報酬</dt>
            <dd className="mt-1 md:mt-2 truncate text-sm md:text-2xl font-semibold text-[color:var(--color-text-primary)]">
              {kpiMetrics.commission.toLocaleString()}
              <span className="text-[10px] md:text-sm font-normal">円</span>
            </dd>
          </div>
        </dl>
      </div>

      {/* 日別パフォーマンス */}
      <div className="ui-card">
        <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">日別パフォーマンス</h2>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">日別のクリック・登録・転換</p>
        <div className="mt-4 overflow-x-auto rounded-[var(--radius-md)] border border-[color:var(--color-border)]">
          {dailyPerformance.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="border-b border-[color:var(--color-border)] text-left text-xs uppercase tracking-wide text-[color:var(--color-text-secondary)]">
                  <th className="px-3 py-2">日付</th>
                  <th className="px-3 py-2 text-right">クリック</th>
                  <th className="px-3 py-2 text-right">無料登録</th>
                  <th className="px-3 py-2 text-right">有料転換</th>
                  <th className="px-3 py-2 text-right">コミッション</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border)]">
                {dailyPerformance.map((row, idx) => (
                  <tr key={row.date || idx} className="hover:bg-[color:var(--color-surface-muted)]">
                    <td className="px-3 py-2 font-medium text-[color:var(--color-text-primary)]">{row.date}</td>
                    <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{row.clicks}</td>
                    <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{row.freeRegistrations}</td>
                    <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{row.paidConversions}</td>
                    <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">
                      {row.commission > 0 ? `${row.commission.toLocaleString()}円` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-3 py-8 text-center text-sm text-[color:var(--color-text-muted)]">まだデータがありません</div>
          )}
        </div>
      </div>

      {/* 紹介実績 + プラン内訳（2カラム） */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* 紹介実績 */}
        <div className="ui-card">
          <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">紹介実績</h2>
          <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">期間内の紹介一覧</p>
          <div className="mt-4 overflow-x-auto rounded-[var(--radius-md)] border border-[color:var(--color-border)]">
            {filteredReferrals.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="border-b border-[color:var(--color-border)] text-left text-xs uppercase tracking-wide text-[color:var(--color-text-secondary)]">
                    <th className="px-3 py-2">日付</th>
                    <th className="px-3 py-2">プラン</th>
                    <th className="px-3 py-2 text-right">コミッション</th>
                    <th className="px-3 py-2 text-right">ステータス</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)]">
                  {filteredReferrals.map((r) => {
                    const status = getStatusLabel(r.status);
                    return (
                      <tr key={r.id} className="hover:bg-[color:var(--color-surface-muted)]">
                        <td className="px-3 py-2 text-[color:var(--color-text-secondary)]">{formatDate(r.created_at)}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-secondary)]">
                            {getPlanLabel(r.plan_id)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-[color:var(--color-text-primary)]">{r.commission_amount.toLocaleString()}円</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                            {status.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="px-3 py-8 text-center text-sm text-[color:var(--color-text-muted)]">まだ紹介実績がありません</div>
            )}
          </div>
        </div>

        {/* プラン内訳 */}
        <div className="ui-card">
          <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">プラン内訳</h2>
          <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">プランごとの紹介数と売上</p>
          <div className="mt-4 overflow-x-auto rounded-[var(--radius-md)] border border-[color:var(--color-border)]">
            {planBreakdown.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="border-b border-[color:var(--color-border)] text-left text-xs uppercase tracking-wide text-[color:var(--color-text-secondary)]">
                    <th className="px-3 py-2">プラン</th>
                    <th className="px-3 py-2 text-right">人数</th>
                    <th className="px-3 py-2 text-right">売上</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)]">
                  {planBreakdown.map((pb) => (
                    <tr key={pb.plan_id} className="hover:bg-[color:var(--color-surface-muted)]">
                      <td className="px-3 py-2 font-medium text-[color:var(--color-text-primary)]">{getPlanLabel(pb.plan_id)}</td>
                      <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{pb.count}人</td>
                      <td className="px-3 py-2 text-right text-[color:var(--color-text-primary)]">{pb.revenue.toLocaleString()}円</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-3 py-8 text-center text-sm text-[color:var(--color-text-muted)]">データなし</div>
            )}
          </div>
        </div>
      </div>

      </>)}

      {/* ===== 設定タブ ===== */}
      {subTab === 'settings' && (<>

      {/* Bank Account Section */}
      <div className="ui-card">
        <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">振込先設定</h2>
        <div className="mt-4 space-y-4">
          {bankError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-[var(--radius-md)] text-sm">
              {bankError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[color:var(--color-text-secondary)] mb-1">銀行名</label>
              <input
                type="text"
                value={bankForm.bank_name}
                onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                placeholder="例: 三菱UFJ銀行"
                className="w-full h-9 px-3 border border-[color:var(--color-border)] rounded-[var(--radius-sm)] text-sm text-[color:var(--color-text-primary)] focus:ring-2 focus:ring-[color:var(--color-text-primary)] focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--color-text-secondary)] mb-1">支店名</label>
              <input
                type="text"
                value={bankForm.branch_name}
                onChange={(e) => setBankForm({ ...bankForm, branch_name: e.target.value })}
                placeholder="例: 渋谷支店"
                className="w-full h-9 px-3 border border-[color:var(--color-border)] rounded-[var(--radius-sm)] text-sm text-[color:var(--color-text-primary)] focus:ring-2 focus:ring-[color:var(--color-text-primary)] focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--color-text-secondary)] mb-1">口座種別</label>
              <select
                value={bankForm.account_type}
                onChange={(e) => setBankForm({ ...bankForm, account_type: e.target.value as 'ordinary' | 'checking' })}
                className="w-full h-9 px-3 border border-[color:var(--color-border)] rounded-[var(--radius-sm)] text-sm text-[color:var(--color-text-primary)] focus:ring-2 focus:ring-[color:var(--color-text-primary)] focus:border-transparent outline-none bg-white"
              >
                <option value="ordinary">普通</option>
                <option value="checking">当座</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--color-text-secondary)] mb-1">口座番号</label>
              <input
                type="text"
                value={bankForm.account_number}
                onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                placeholder="1234567"
                maxLength={8}
                className="w-full h-9 px-3 border border-[color:var(--color-border)] rounded-[var(--radius-sm)] text-sm text-[color:var(--color-text-primary)] focus:ring-2 focus:ring-[color:var(--color-text-primary)] focus:border-transparent outline-none font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[color:var(--color-text-secondary)] mb-1">口座名義（カタカナ）</label>
              <input
                type="text"
                value={bankForm.account_holder}
                onChange={(e) => setBankForm({ ...bankForm, account_holder: e.target.value })}
                placeholder="クドウ タロウ"
                className="w-full h-9 px-3 border border-[color:var(--color-border)] rounded-[var(--radius-sm)] text-sm text-[color:var(--color-text-primary)] focus:ring-2 focus:ring-[color:var(--color-text-primary)] focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Invoice */}
          <div className="border-t border-[color:var(--color-border)] pt-4">
            <div className="flex items-center gap-3 mb-3">
              <label className="text-xs font-medium text-[color:var(--color-text-secondary)]">インボイス番号</label>
              <button
                type="button"
                onClick={() => setBankForm({ ...bankForm, has_invoice: !bankForm.has_invoice, invoice_number: bankForm.has_invoice ? '' : bankForm.invoice_number })}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  bankForm.has_invoice ? 'bg-[color:var(--color-text-primary)]' : 'bg-[color:var(--color-border)]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                    bankForm.has_invoice ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-xs text-[color:var(--color-text-muted)]">{bankForm.has_invoice ? 'あり' : 'なし'}</span>
            </div>
            {bankForm.has_invoice && (
              <div>
                <input
                  type="text"
                  value={bankForm.invoice_number}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (!val.startsWith('T')) val = 'T' + val.replace(/^T/, '');
                    val = 'T' + val.slice(1).replace(/\D/g, '').slice(0, 13);
                    setBankForm({ ...bankForm, invoice_number: val });
                  }}
                  placeholder="T1234567890123"
                  maxLength={14}
                  className="w-full sm:w-64 h-9 px-3 border border-[color:var(--color-border)] rounded-[var(--radius-sm)] text-sm text-[color:var(--color-text-primary)] focus:ring-2 focus:ring-[color:var(--color-text-primary)] focus:border-transparent outline-none font-mono"
                />
                <p className="text-xs text-[color:var(--color-text-muted)] mt-1">T + 13桁の数字</p>
              </div>
            )}
          </div>

          {/* Identity document upload */}
          <div className="border-t border-[color:var(--color-border)] pt-4">
            <label className="block text-xs font-medium text-[color:var(--color-text-secondary)] mb-2">本人確認書類</label>
            {identityUploaded ? (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-[var(--radius-sm)] px-4 py-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                アップロード済み
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setIdentityFile(e.target.files?.[0] || null)}
                  className="text-sm text-[color:var(--color-text-secondary)] file:mr-3 file:py-2 file:px-4 file:rounded-[var(--radius-sm)] file:border-0 file:text-sm file:font-medium file:bg-[color:var(--color-surface-muted)] file:text-[color:var(--color-text-secondary)] hover:file:bg-[color:var(--color-border)]"
                />
                {identityFile && (
                  <button
                    onClick={handleIdentityUpload}
                    disabled={identityUploading}
                    className="px-4 h-9 bg-[color:var(--color-surface-muted)] hover:bg-[color:var(--color-border)] text-[color:var(--color-text-secondary)] text-sm font-medium rounded-[var(--radius-sm)] transition-colors disabled:opacity-50"
                  >
                    {identityUploading ? 'アップロード中...' : 'アップロード'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Save button */}
          <div className="border-t border-[color:var(--color-border)] pt-4 flex items-center gap-3">
            <button
              onClick={handleBankSave}
              disabled={bankSaving || !bankForm.bank_name || !bankForm.account_number || !bankForm.account_holder}
              className="h-9 px-6 bg-[color:var(--color-text-primary)] hover:opacity-90 text-white text-sm font-semibold rounded-[var(--radius-sm)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bankSaving ? '保存中...' : bankSaved ? '更新する' : '保存する'}
            </button>
            {bankSaved && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                保存済み
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800">
          インボイス登録番号がない場合、報酬から源泉徴収税（10.21%）が差し引かれます。
        </p>
      </div>

      </>)}
    </div>
  );
}
