/**
 * ANALYCA サブスクリプションプラン定義（一元管理）
 * checkout/page.tsx と api/payment/subscribe/route.ts の両方からimportする
 */

export interface Plan {
  name: string;
  subtitle: string;
  price: number;
  onboardingPath: string;
  /** trueの場合、年払いプラン（12ヶ月分一括） */
  yearly?: boolean;
  /** trueの場合、pricing UIには表示しない（既存ユーザー用に残す） */
  hidden?: boolean;
}

export const PLANS: Record<string, Plan> = {
  'light-threads': {
    name: 'Light',
    subtitle: 'Threads分析',
    price: 4980,
    onboardingPath: '/onboarding/light',
  },
  'light-threads-yearly': {
    name: 'Light',
    subtitle: 'Threads分析（年払い）',
    price: 47760,
    onboardingPath: '/onboarding/light',
    yearly: true,
  },
  'light-instagram': {
    name: 'Light',
    subtitle: 'Instagram分析',
    price: 4980,
    onboardingPath: '/onboarding/light2',
    hidden: true, // 既存ユーザー用に残す。pricing UIからは非表示
  },
  'standard': {
    name: 'Standard',
    subtitle: 'Instagram + Threads',
    price: 9800,
    onboardingPath: '/onboarding/standard',
  },
  'standard-yearly': {
    name: 'Standard',
    subtitle: 'Instagram + Threads（年払い）',
    price: 94080,
    onboardingPath: '/onboarding/standard',
    yearly: true,
  },
  'pro': {
    name: 'Pro',
    subtitle: '全機能 + 予約投稿無制限',
    price: 19000,
    onboardingPath: '/onboarding/standard',
  },
  'pro-yearly': {
    name: 'Pro',
    subtitle: '全機能 + 予約投稿無制限（年払い）',
    price: 182400,
    onboardingPath: '/onboarding/standard',
    yearly: true,
  },
};

export type BillableChannel = 'instagram' | 'threads';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['current', 'active', 'trial']);

export function hasActiveSubscriptionAccess(subscriptionStatus: string | null | undefined): boolean {
  return ACTIVE_SUBSCRIPTION_STATUSES.has(subscriptionStatus || '');
}

export function isChannelBlockedByPlan(
  planId: string | null | undefined,
  channel: BillableChannel
): boolean {
  if (channel === 'instagram') {
    return planId === 'light-threads' || planId === 'light-threads-yearly';
  }

  return planId === 'light-instagram' || planId === 'light-instagram-yearly';
}

export function resolveEffectivePlanId(
  planId: string | null | undefined,
  channels: { has_threads?: boolean | null; has_instagram?: boolean | null }
): string | null {
  if (planId) return planId;
  if (channels.has_threads && channels.has_instagram) return 'standard';
  if (channels.has_threads) return 'light-threads';
  if (channels.has_instagram) return 'light-instagram';
  return null;
}

export function canUseChannelBySubscription(
  planId: string | null | undefined,
  subscriptionStatus: string | null | undefined,
  channel: BillableChannel
): boolean {
  if (!hasActiveSubscriptionAccess(subscriptionStatus)) return false;
  return !isChannelBlockedByPlan(planId, channel);
}
