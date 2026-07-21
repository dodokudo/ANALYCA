import { randomUUID } from 'crypto';
import {
  getUserById,
  getUserSubscriptionStatus,
  updateUserSubscription,
} from './bigquery';
import { syncAnalycaUserRecordToLineHarness } from './line-harness-sync';
import {
  cancelSubscription,
  createSubscriptionFromToken,
  getSubscription,
  updateSubscription,
} from './univapay/client';
import {
  getUnivaPaySubscriptionPeriod,
  PLANS,
  PUBLIC_PLAN_BASE_IDS,
} from './univapay/plans';

const PLAN_CHANGE_STATUSES = new Set(['current', 'active', 'trial']);
const PUBLIC_PLAN_IDS = new Set(
  PUBLIC_PLAN_BASE_IDS.flatMap((basePlanId) => [basePlanId, `${basePlanId}-yearly`]),
);

export class PlanChangeValidationError extends Error {}

export interface ScheduledPlanChangeResult {
  targetPlanId: string;
  pendingSubscriptionId: string;
  effectiveAt: string;
  message: string;
}

function getEffectiveDate(value: string | null | undefined): { startOn: string; effectiveAt: Date } {
  const startOn = value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!startOn) {
    throw new PlanChangeValidationError('次回更新日を確認できないため、プランを変更できませんでした');
  }

  const effectiveAt = new Date(`${startOn}T07:00:00+09:00`);
  if (Number.isNaN(effectiveAt.getTime())) {
    throw new PlanChangeValidationError('次回更新日が不正です');
  }
  return { startOn, effectiveAt };
}

function formatEffectiveDate(date: Date): string {
  return date.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export async function scheduleSubscriptionPlanChange(
  userId: string,
  targetPlanId: string,
): Promise<ScheduledPlanChangeResult> {
  if (!PUBLIC_PLAN_IDS.has(targetPlanId)) {
    throw new PlanChangeValidationError('変更先プランが不正です');
  }

  const [user, status] = await Promise.all([
    getUserById(userId),
    getUserSubscriptionStatus(userId),
  ]);

  if (!user || !status.subscription_id || !status.plan_id) {
    throw new PlanChangeValidationError('有効なサブスクリプションが見つかりません');
  }
  if (!PLAN_CHANGE_STATUSES.has(status.subscription_status)) {
    throw new PlanChangeValidationError('現在の契約状態ではプランを変更できません');
  }
  if (status.plan_id === targetPlanId) {
    throw new PlanChangeValidationError('現在と同じプランが選択されています');
  }
  if (status.pending_plan_id || status.pending_subscription_id) {
    if (
      status.pending_plan_id === targetPlanId
      && status.pending_subscription_id
      && status.plan_change_effective_at
    ) {
      const targetPlan = PLANS[targetPlanId];
      const effectiveAt = new Date(status.plan_change_effective_at);
      return {
        targetPlanId,
        pendingSubscriptionId: status.pending_subscription_id,
        effectiveAt: effectiveAt.toISOString(),
        message: `${formatEffectiveDate(effectiveAt)}から${targetPlan.name}プランに変更予定です`,
      };
    }
    throw new PlanChangeValidationError('すでにプラン変更が予約されています');
  }

  const targetPlan = PLANS[targetPlanId];
  const currentSubscription = await getSubscription(status.subscription_id);
  const { startOn, effectiveAt } = getEffectiveDate(
    currentSubscription.next_payment_date || currentSubscription.next_payment?.due_date,
  );
  const transactionTokenId = currentSubscription.transaction_token_id || user.recurring_token_id;
  if (!transactionTokenId) {
    throw new PlanChangeValidationError('登録済みのカード情報を確認できませんでした');
  }

  const requestId = randomUUID();
  let pendingSubscriptionId: string | null = null;
  let oldCancellationScheduled = false;

  await updateUserSubscription(userId, {
    pending_plan_id: targetPlanId,
    pending_subscription_id: null,
    plan_change_effective_at: effectiveAt,
    plan_change_request_id: requestId,
  });

  try {
    const pendingSubscription = await createSubscriptionFromToken({
      recurringTokenId: transactionTokenId,
      amount: targetPlan.price,
      period: getUnivaPaySubscriptionPeriod(targetPlanId),
      schedule_settings: {
        start_on: startOn,
        zone_id: 'Asia/Tokyo',
      },
      metadata: {
        analycaUserId: userId,
        planId: targetPlanId,
        planName: targetPlan.name,
        planChangeRequestId: requestId,
        replacesSubscriptionId: status.subscription_id,
      },
      idempotencyKey: `analyca-plan-change-create-${requestId}`,
    });
    pendingSubscriptionId = pendingSubscription.id;

    await updateUserSubscription(userId, {
      pending_subscription_id: pendingSubscriptionId,
    });

    await updateSubscription(
      status.subscription_id,
      {
        schedule_settings: { termination_mode: 'on_next_payment' },
        metadata: {
          ...(currentSubscription.metadata || {}),
          pendingPlanId: targetPlanId,
          pendingSubscriptionId,
          planChangeRequestId: requestId,
        },
      },
      `analyca-plan-change-update-${requestId}`,
    );
    await cancelSubscription(status.subscription_id);
    oldCancellationScheduled = true;

    try {
      const updatedUser = await getUserById(userId);
      if (updatedUser) await syncAnalycaUserRecordToLineHarness(updatedUser);
    } catch (syncError) {
      console.error('[plan-change] Failed to sync pending change to LINE Harness:', syncError);
    }

    return {
      targetPlanId,
      pendingSubscriptionId,
      effectiveAt: effectiveAt.toISOString(),
      message: `${formatEffectiveDate(effectiveAt)}から${targetPlan.name}プランに変更予定です`,
    };
  } catch (error) {
    if (!oldCancellationScheduled) {
      if (pendingSubscriptionId) {
        await cancelSubscription(pendingSubscriptionId).catch((rollbackError) =>
          console.error('[plan-change] Failed to cancel replacement subscription:', rollbackError),
        );
      }
      await updateUserSubscription(userId, {
        pending_plan_id: null,
        pending_subscription_id: null,
        plan_change_effective_at: null,
        plan_change_request_id: null,
      }).catch((rollbackError) =>
        console.error('[plan-change] Failed to clear pending state:', rollbackError),
      );
    }
    throw error;
  }
}
