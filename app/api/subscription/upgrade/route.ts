import { NextRequest, NextResponse } from 'next/server';
import {
  getUserById,
  getUserSubscriptionStatus,
  updateUserSubscription,
} from '@/lib/bigquery';
import {
  createCharge,
  getSubscription,
  updateSubscription,
} from '@/lib/univapay/client';
import { PLANS, resolveEffectivePlanId } from '@/lib/univapay/plans';

const UPGRADABLE_STATUSES = new Set(['current', 'active', 'trial', 'unpaid', 'suspended']);

function resolveTargetPlanId(currentPlanId: string, requestedPlanId: string): string {
  if (currentPlanId.endsWith('-yearly')) {
    if (requestedPlanId === 'standard') return 'standard-yearly';
    if (requestedPlanId === 'pro') return 'pro-yearly';
  }
  return requestedPlanId;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, targetPlanId } = await request.json();

    if (!userId || !targetPlanId) {
      return NextResponse.json(
        { success: false, error: 'userId and targetPlanId are required' },
        { status: 400 },
      );
    }

    const [subStatus, user] = await Promise.all([
      getUserSubscriptionStatus(userId),
      getUserById(userId),
    ]);

    if (!subStatus.subscription_id) {
      return NextResponse.json(
        { success: false, error: '有効なサブスクリプションが見つかりません' },
        { status: 400 },
      );
    }

    if (!UPGRADABLE_STATUSES.has(subStatus.subscription_status)) {
      return NextResponse.json(
        { success: false, error: '現在の契約状態ではアップグレードできません' },
        { status: 400 },
      );
    }

    const currentPlanId = resolveEffectivePlanId(subStatus.plan_id, {
      has_threads: user?.has_threads,
      has_instagram: user?.has_instagram,
    });

    if (!currentPlanId || !PLANS[currentPlanId]) {
      return NextResponse.json(
        { success: false, error: '現在のプランを判定できませんでした' },
        { status: 400 },
      );
    }

    const resolvedTargetPlanId = resolveTargetPlanId(currentPlanId, targetPlanId);
    const currentPlan = PLANS[currentPlanId];
    const targetPlan = PLANS[resolvedTargetPlanId];

    if (!targetPlan) {
      return NextResponse.json(
        { success: false, error: 'アップグレード先プランが不正です' },
        { status: 400 },
      );
    }

    if (currentPlan.yearly !== targetPlan.yearly) {
      return NextResponse.json(
        { success: false, error: '月払い/年払いをまたぐ変更はこの画面では対応していません' },
        { status: 400 },
      );
    }

    if (targetPlan.price <= currentPlan.price) {
      return NextResponse.json(
        { success: false, error: '現在のプランより上位のプランを選択してください' },
        { status: 400 },
      );
    }

    const subscription = await getSubscription(subStatus.subscription_id);
    const currentAmount = subscription.amount || currentPlan.price;
    const diffAmount = targetPlan.price - currentAmount;

    if (diffAmount < 0) {
      return NextResponse.json(
        { success: false, error: '現在の契約金額より高いプランへの変更のみ対応しています' },
        { status: 400 },
      );
    }

    await updateSubscription(subStatus.subscription_id, {
      amount: targetPlan.price,
      metadata: {
        ...(subscription.metadata || {}),
        planId: resolvedTargetPlanId,
        planName: targetPlan.name,
        upgradedFromPlanId: currentPlanId,
      },
    });

    try {
      if (diffAmount > 0) {
        const charge = await createCharge({
          transaction_token_id: subscription.transaction_token_id,
          amount: diffAmount,
          currency: 'JPY',
          metadata: {
            userId,
            type: 'subscription_upgrade_diff',
            fromPlanId: currentPlanId,
            toPlanId: resolvedTargetPlanId,
          },
        });

        if (charge.status !== 'successful' && charge.status !== 'authorized') {
          throw new Error(`差額決済に失敗しました（status: ${charge.status}）`);
        }
      }
    } catch (chargeError) {
      // 差額決済に失敗したら、翌月以降の課金額も元に戻す。
      await updateSubscription(subStatus.subscription_id, {
        amount: currentAmount,
        metadata: {
          ...(subscription.metadata || {}),
          planId: currentPlanId,
          planName: currentPlan.name,
          upgradeRollbackFromPlanId: resolvedTargetPlanId,
        },
      });
      throw chargeError;
    }

    await updateUserSubscription(userId, {
      plan_id: resolvedTargetPlanId,
      subscription_status: subStatus.subscription_status === 'trial'
        ? 'current'
        : subStatus.subscription_status,
      subscription_expires_at: undefined,
    });

    return NextResponse.json({
      success: true,
      planId: resolvedTargetPlanId,
      diffAmount,
      message: diffAmount > 0
        ? `Standardプランへ更新し、差額 ${diffAmount.toLocaleString('ja-JP')}円 を決済しました`
        : 'Standardプランへ更新しました',
    });
  } catch (error) {
    console.error('Subscription upgrade error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upgrade subscription',
      },
      { status: 500 },
    );
  }
}
