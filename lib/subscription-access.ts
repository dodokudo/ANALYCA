import type { User } from '@/lib/bigquery';
import {
  isChannelBlockedByPlan,
  resolveEffectivePlanId,
  type BillableChannel,
} from '@/lib/univapay/plans';

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
  return null;
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
  const trialEndsAt = user ? asDate(user.trial_ends_at) : null;

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

  if (normalizedStatus === 'trial') {
    if (!trialEndsAt || trialEndsAt > now) {
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
      title: '無料期間が終了しています',
      message: '課金を完了するとダッシュボードを引き続き確認できます。',
      actionLabel: '課金して再開する',
      actionType: 'reactivate',
      status,
      expiresAt,
    };
  }

  if (normalizedStatus === 'current' || normalizedStatus === 'active') {
    if (!paidThrough || paidThrough > now) {
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

export function hasSubscriptionAccess(user: User | null, now: Date = new Date()): boolean {
  const status = (user?.subscription_status || '').toLowerCase();
  if (!user || !status || status === 'none') return false;
  return evaluateDashboardAccess(user, { now }).allowed;
}

export function canConnectChannel(
  user: User | null,
  channel: BillableChannel,
  now: Date = new Date(),
): user is User {
  if (!hasSubscriptionAccess(user, now) || !user) return false;

  const planId = resolveEffectivePlanId(user.plan_id, {
    has_threads: user.has_threads,
    has_instagram: user.has_instagram,
  });
  return !!planId && !isChannelBlockedByPlan(planId, channel);
}
