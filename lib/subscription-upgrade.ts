import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import {
  createSubscriptionUpgradeAttempt,
  getRecoverableSubscriptionUpgradeAttempts,
  getSubscriptionUpgradeAttempt,
  getUserById,
  getUserSubscriptionStatus,
  type SubscriptionUpgradeAttempt,
  updateSubscriptionUpgradeAttempt,
  updateUserSubscription,
} from './bigquery';
import { syncAnalycaUserRecordToLineHarness } from './line-harness-sync';
import {
  calculateProratedUpgradeQuote,
  type ProratedUpgradeQuote,
} from './subscription-upgrade-policy';
import {
  createCharge,
  getCharge,
  getSubscription,
  updateSubscription,
  type UnivaPayCharge,
  type UnivaPaySubscription,
} from './univapay/client';
import {
  getPlanBillingCycle,
  PLANS,
  resolveEffectivePlanId,
} from './univapay/plans';

const IMMEDIATE_UPGRADE_STATUSES = new Set(['current', 'active']);
const SUCCESSFUL_CHARGE_STATUSES = new Set(['successful', 'authorized']);
const TERMINAL_FAILED_CHARGE_STATUSES = new Set(['failed', 'error', 'canceled']);

export class SubscriptionUpgradeValidationError extends Error {}

export interface SubscriptionUpgradeQuote extends ProratedUpgradeQuote {
  attemptId: string;
  currentPlanId: string;
  targetPlanId: string;
  currentRecurringAmount: number;
  targetRecurringAmount: number;
  nextBillingDate: string;
}

interface PreparedUpgrade {
  quote: SubscriptionUpgradeQuote;
  subscription: UnivaPaySubscription;
}

export interface SubscriptionUpgradeResult extends SubscriptionUpgradeQuote {
  success: boolean;
  processing?: boolean;
  chargeId?: string;
  message: string;
}

function resolveTargetPlanId(currentPlanId: string, requestedPlanId: string): string {
  if (currentPlanId.endsWith('-yearly')) {
    if (requestedPlanId === 'standard') return 'standard-yearly';
    if (requestedPlanId === 'pro') return 'pro-yearly';
  }
  return requestedPlanId;
}

function buildAttemptId(input: {
  subscriptionId: string;
  transactionTokenId: string;
  targetPlanId: string;
  periodEnd: string;
}): string {
  const digest = createHash('sha256')
    .update(`${input.subscriptionId}|${input.transactionTokenId}|${input.targetPlanId}|${input.periodEnd}`)
    .digest('hex')
    .slice(0, 32);
  return `analyca-upgrade-${digest}`;
}

async function prepareSubscriptionUpgrade(
  userId: string,
  requestedTargetPlanId: string,
  now: Date = new Date(),
): Promise<PreparedUpgrade> {
  const [status, user] = await Promise.all([
    getUserSubscriptionStatus(userId),
    getUserById(userId),
  ]);

  if (!status.subscription_id || !user) {
    throw new SubscriptionUpgradeValidationError('有効なサブスクリプションが見つかりません');
  }
  if (!IMMEDIATE_UPGRADE_STATUSES.has(status.subscription_status)) {
    throw new SubscriptionUpgradeValidationError('現在の契約状態では即時アップグレードできません');
  }
  if (status.pending_plan_id || status.pending_subscription_id) {
    throw new SubscriptionUpgradeValidationError('予約済みのプラン変更があります');
  }

  const currentPlanId = resolveEffectivePlanId(status.plan_id, {
    has_threads: user.has_threads,
    has_instagram: user.has_instagram,
  });
  if (!currentPlanId || !PLANS[currentPlanId]) {
    throw new SubscriptionUpgradeValidationError('現在のプランを判定できませんでした');
  }

  const targetPlanId = resolveTargetPlanId(currentPlanId, requestedTargetPlanId);
  const currentPlan = PLANS[currentPlanId];
  const targetPlan = PLANS[targetPlanId];
  if (!targetPlan) {
    throw new SubscriptionUpgradeValidationError('アップグレード先プランが不正です');
  }
  if (getPlanBillingCycle(currentPlanId) !== getPlanBillingCycle(targetPlanId)) {
    throw new SubscriptionUpgradeValidationError('月払い/年払いをまたぐ変更は次回更新日に反映されます');
  }
  if (targetPlan.price <= currentPlan.price) {
    throw new SubscriptionUpgradeValidationError('現在のプランより上位のプランを選択してください');
  }

  const subscription = await getSubscription(status.subscription_id);
  const currentRecurringAmount = subscription.amount || currentPlan.price;
  const nextBillingDate = subscription.next_payment_date || subscription.next_payment?.due_date;
  if (!nextBillingDate) {
    throw new SubscriptionUpgradeValidationError('次回更新日を確認できませんでした');
  }
  if (!subscription.transaction_token_id) {
    throw new SubscriptionUpgradeValidationError('登録済みのカード情報を確認できませんでした');
  }

  const proration = calculateProratedUpgradeQuote({
    currentPrice: currentRecurringAmount,
    targetPrice: targetPlan.price,
    billingCycle: getPlanBillingCycle(targetPlanId),
    nextBillingDate,
    now,
  });
  const attemptId = buildAttemptId({
    subscriptionId: subscription.id,
    transactionTokenId: subscription.transaction_token_id,
    targetPlanId,
    periodEnd: proration.periodEnd,
  });

  return {
    subscription,
    quote: {
      ...proration,
      attemptId,
      currentPlanId,
      targetPlanId,
      currentRecurringAmount,
      targetRecurringAmount: targetPlan.price,
      nextBillingDate: proration.periodEnd,
    },
  };
}

export async function getSubscriptionUpgradeQuote(
  userId: string,
  targetPlanId: string,
  now: Date = new Date(),
): Promise<SubscriptionUpgradeQuote> {
  return (await prepareSubscriptionUpgrade(userId, targetPlanId, now)).quote;
}

async function finalizeUpgradeAttempt(attempt: SubscriptionUpgradeAttempt): Promise<void> {
  const targetPlan = PLANS[attempt.target_plan_id];
  const currentPlan = PLANS[attempt.from_plan_id];
  if (!targetPlan || !currentPlan) throw new Error('Upgrade attempt contains an unknown plan');

  const subscription = await getSubscription(attempt.subscription_id);
  if (subscription.amount !== attempt.target_amount
    || subscription.next_payment?.amount !== attempt.target_amount) {
    await updateSubscription(attempt.subscription_id, {
      amount: attempt.target_amount,
      next_payment: {
        amount: attempt.target_amount,
        terminate_with_status: '',
      },
      metadata: {
        ...(subscription.metadata || {}),
        planId: attempt.target_plan_id,
        planName: targetPlan.name,
        upgradedFromPlanId: attempt.from_plan_id,
        upgradeAttemptId: attempt.attempt_id,
      },
    }, `${attempt.attempt_id}-subscription`);
  }

  await updateUserSubscription(attempt.user_id, {
    plan_id: attempt.target_plan_id,
    subscription_status: 'current',
  });

  try {
    const updatedUser = await getUserById(attempt.user_id);
    if (updatedUser) await syncAnalycaUserRecordToLineHarness(updatedUser);
  } catch (syncError) {
    console.error('[subscription-upgrade] LINE Harness sync failed:', syncError);
  }

  await updateSubscriptionUpgradeAttempt(attempt.attempt_id, {
    status: 'completed',
    charge_id: attempt.charge_id,
  });
}

async function resolveAttemptCharge(attempt: SubscriptionUpgradeAttempt): Promise<UnivaPayCharge> {
  if (attempt.charge_id) return getCharge(attempt.charge_id);

  try {
    const charge = await createCharge({
      transaction_token_id: attempt.transaction_token_id,
      amount: attempt.prorated_amount,
      currency: 'JPY',
      idempotencyKey: attempt.attempt_id,
      metadata: {
        userId: attempt.user_id,
        subscription_id: attempt.subscription_id,
        type: 'subscription_upgrade_diff',
        attemptId: attempt.attempt_id,
        fromPlanId: attempt.from_plan_id,
        toPlanId: attempt.target_plan_id,
        periodStart: attempt.period_start,
        periodEnd: attempt.period_end,
      },
    });
    await updateSubscriptionUpgradeAttempt(attempt.attempt_id, {
      status: 'charge_created',
      charge_id: charge.id,
    });
    return charge;
  } catch (error) {
    await updateSubscriptionUpgradeAttempt(attempt.attempt_id, {
      status: 'processing',
      error_message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function processUpgradeAttempt(
  attempt: SubscriptionUpgradeAttempt,
  pollAttempts = 30,
): Promise<SubscriptionUpgradeResult> {
  const quote: SubscriptionUpgradeQuote = {
    attemptId: attempt.attempt_id,
    currentPlanId: attempt.from_plan_id,
    targetPlanId: attempt.target_plan_id,
    currentRecurringAmount: attempt.current_amount,
    targetRecurringAmount: attempt.target_amount,
    proratedAmount: attempt.prorated_amount,
    fullDifference: attempt.target_amount - attempt.current_amount,
    periodStart: attempt.period_start,
    periodEnd: attempt.period_end,
    nextBillingDate: attempt.period_end,
    remainingDays: attempt.remaining_days,
    totalDays: attempt.total_days,
  };

  if (attempt.status === 'completed') {
    return {
      ...quote,
      success: true,
      chargeId: attempt.charge_id || undefined,
      message: `${PLANS[attempt.target_plan_id].name}プランへ変更済みです`,
    };
  }
  if (attempt.status === 'failed') {
    throw new Error(attempt.error_message || '差額決済に失敗しました');
  }

  let charge = await resolveAttemptCharge(attempt);
  for (let count = 0; count < pollAttempts && ['pending', 'awaiting'].includes(charge.status); count += 1) {
    await delay(1000);
    charge = await getCharge(charge.id);
  }

  if (SUCCESSFUL_CHARGE_STATUSES.has(charge.status)) {
    await updateSubscriptionUpgradeAttempt(attempt.attempt_id, {
      status: 'charged',
      charge_id: charge.id,
    });
    await finalizeUpgradeAttempt({ ...attempt, charge_id: charge.id, status: 'charged' });
    return {
      ...quote,
      success: true,
      chargeId: charge.id,
      message: `${PLANS[attempt.target_plan_id].name}プランへ更新し、日割り差額 ${attempt.prorated_amount.toLocaleString('ja-JP')}円 を決済しました`,
    };
  }

  if (TERMINAL_FAILED_CHARGE_STATUSES.has(charge.status)) {
    const errorMessage = `差額決済に失敗しました（status: ${charge.status}）`;
    await updateSubscriptionUpgradeAttempt(attempt.attempt_id, {
      status: 'failed',
      charge_id: charge.id,
      error_message: errorMessage,
    });
    throw new Error(errorMessage);
  }

  return {
    ...quote,
    success: false,
    processing: true,
    chargeId: charge.id,
    message: '差額決済を確認中です。確認後、自動的にプランを反映します',
  };
}

export async function executeSubscriptionUpgrade(
  userId: string,
  targetPlanId: string,
): Promise<SubscriptionUpgradeResult> {
  const prepared = await prepareSubscriptionUpgrade(userId, targetPlanId);
  const attempt = await createSubscriptionUpgradeAttempt({
    attempt_id: prepared.quote.attemptId,
    user_id: userId,
    subscription_id: prepared.subscription.id,
    transaction_token_id: prepared.subscription.transaction_token_id,
    from_plan_id: prepared.quote.currentPlanId,
    target_plan_id: prepared.quote.targetPlanId,
    current_amount: prepared.quote.currentRecurringAmount,
    target_amount: prepared.quote.targetRecurringAmount,
    prorated_amount: prepared.quote.proratedAmount,
    period_start: prepared.quote.periodStart,
    period_end: prepared.quote.periodEnd,
    remaining_days: prepared.quote.remainingDays,
    total_days: prepared.quote.totalDays,
  });
  return processUpgradeAttempt(attempt);
}

export async function reconcileSubscriptionUpgradeAttempt(attemptId: string): Promise<void> {
  const attempt = await getSubscriptionUpgradeAttempt(attemptId);
  if (!attempt || attempt.status === 'completed' || attempt.status === 'failed') return;
  await processUpgradeAttempt(attempt, 1);
}

export async function reconcileRecoverableSubscriptionUpgrades(): Promise<Array<{
  attemptId: string;
  status: 'reconciled' | 'processing' | 'failed';
  error?: string;
}>> {
  const attempts = await getRecoverableSubscriptionUpgradeAttempts();
  const results = [];
  for (const attempt of attempts) {
    try {
      const result = await processUpgradeAttempt(attempt, 0);
      results.push({
        attemptId: attempt.attempt_id,
        status: result.processing ? 'processing' as const : 'reconciled' as const,
      });
    } catch (error) {
      results.push({
        attemptId: attempt.attempt_id,
        status: 'failed' as const,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
