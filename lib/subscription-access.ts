import type { User } from '@/lib/bigquery';

export type DashboardAccessState =
  | 'allowed'
  | 'admin_allowed'
  | 'payment_failed'
  | 'expired'
  | 'canceled_expired'
  | 'suspended'
  | 'unknown_allowed';

export interface DashboardAccessResult {
  allowed: boolean;
  state: DashboardAccessState;
  title?: string;
  message?: string;
  actionLabel?: string;
  actionType?: 'payment_method' | 'reactivate';
  status: string | null;
  expiresAt: string | null;
}

const ACTIVE_STATUSES = new Set(['current', 'active', 'trial']);
const CANCELED_STATUSES = new Set(['canceled', 'cancelled']);
const PAYMENT_FAILED_STATUSES = new Set(['unpaid', 'unconfirmed']);

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function inferPaidThrough(user: User): Date | null {
  const explicitExpiresAt = asDate(user.subscription_expires_at);
  if (explicitExpiresAt) return explicitExpiresAt;

  const createdAt = asDate(user.subscription_created_at);
  if (!createdAt) return null;

  const inferred = new Date(createdAt);
  const planId = user.plan_id || '';
  inferred.setDate(inferred.getDate() + (planId.includes('yearly') ? 366 : 31));
  return inferred;
}

export function evaluateDashboardAccess(
  user: User | null,
  options: { isAdmin?: boolean; now?: Date } = {},
): DashboardAccessResult {
  const now = options.now || new Date();
  const status = user?.subscription_status || null;
  const normalizedStatus = (status || 'none').toLowerCase();
  const paidThrough = user ? inferPaidThrough(user) : null;
  const expiresAt = paidThrough?.toISOString() || null;

  if (options.isAdmin) {
    return {
      allowed: true,
      state: 'admin_allowed',
      status,
      expiresAt,
    };
  }

  if (!user || normalizedStatus === 'none') {
    return {
      allowed: true,
      state: 'unknown_allowed',
      status,
      expiresAt,
    };
  }

  if (ACTIVE_STATUSES.has(normalizedStatus)) {
    return {
      allowed: true,
      state: 'allowed',
      status,
      expiresAt,
    };
  }

  if (CANCELED_STATUSES.has(normalizedStatus)) {
    if (paidThrough && paidThrough > now) {
      return {
        allowed: true,
        state: 'allowed',
        status,
        expiresAt,
      };
    }

    return {
      allowed: false,
      state: 'canceled_expired',
      title: 'ご契約期間が終了しています',
      message: '再契約するとダッシュボードを再び確認できます。',
      actionLabel: '再契約する',
      actionType: 'reactivate',
      status,
      expiresAt,
    };
  }

  if (PAYMENT_FAILED_STATUSES.has(normalizedStatus)) {
    return {
      allowed: false,
      state: 'payment_failed',
      title: 'カード決済が完了できていません',
      message: '登録済みカードの有効期限や利用状況を確認し、カード情報を更新してください。',
      actionLabel: 'カード情報を変更する',
      actionType: 'payment_method',
      status,
      expiresAt,
    };
  }

  if (normalizedStatus === 'suspended') {
    return {
      allowed: false,
      state: 'suspended',
      title: 'ご契約が一時停止されています',
      message: 'カード情報を確認し、再開手続きを行ってください。',
      actionLabel: 'カード情報を変更する',
      actionType: 'payment_method',
      status,
      expiresAt,
    };
  }

  if (normalizedStatus === 'expired') {
    if (paidThrough && paidThrough > now) {
      return {
        allowed: true,
        state: 'allowed',
        status,
        expiresAt,
      };
    }

    return {
      allowed: false,
      state: 'expired',
      title: 'ご契約期間が終了しています',
      message: '再契約するとダッシュボードを再び確認できます。',
      actionLabel: '再契約する',
      actionType: 'reactivate',
      status,
      expiresAt,
    };
  }

  return {
    allowed: true,
    state: 'unknown_allowed',
    status,
    expiresAt,
  };
}
