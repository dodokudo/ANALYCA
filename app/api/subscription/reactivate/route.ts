import { NextRequest, NextResponse } from 'next/server';
import { getUserById, updateUserSubscription } from '@/lib/bigquery';
import { createSubscriptionFromToken, getSubscription, updateSubscription } from '@/lib/univapay/client';
import { PLANS } from '@/lib/univapay/plans';
import { syncAnalycaUserRecordToLineHarness } from '@/lib/line-harness-sync';

function getSubscriptionPeriod(planId: string): 'monthly' | 'yearly' {
  return planId.includes('yearly') ? 'yearly' : 'monthly';
}

function getNextPaymentDate(subscription: { next_payment_date?: string | null; next_payment?: { due_date?: string | null } }): Date | null {
  const value = subscription.next_payment_date || subscription.next_payment?.due_date || null;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = typeof body?.userId === 'string' ? body.userId : '';

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'ユーザーが見つかりません' }, { status: 404 });
    }

    const planId = user.plan_id || 'light-threads';
    const plan = PLANS[planId];
    if (!plan) {
      return NextResponse.json({ success: false, error: 'プラン情報が見つかりません' }, { status: 400 });
    }

    const status = (user.subscription_status || 'none').toLowerCase();

    if (status === 'current' || status === 'active' || status === 'trial') {
      return NextResponse.json({ success: true, status: user.subscription_status, alreadyActive: true });
    }

    if ((status === 'unpaid' || status === 'unconfirmed' || status === 'suspended') && user.subscription_id) {
      const updated = status === 'suspended'
        ? await updateSubscription(user.subscription_id, {
            status: 'unpaid',
            next_payment: { terminate_with_status: '' },
          })
        : await getSubscription(user.subscription_id);
      const nextPaymentDate = getNextPaymentDate(updated);

      await updateUserSubscription(userId, {
        subscription_status: updated.status || (status === 'suspended' ? 'unpaid' : user.subscription_status || 'unpaid'),
        subscription_expires_at: nextPaymentDate,
      });

      const updatedUser = await getUserById(userId);
      if (updatedUser) await syncAnalycaUserRecordToLineHarness(updatedUser);

      return NextResponse.json({
        success: true,
        status: updated.status,
        subscriptionId: updated.id,
        nextPaymentDate: nextPaymentDate?.toISOString() || null,
      });
    }

    if (!user.recurring_token_id) {
      return NextResponse.json({
        success: false,
        requiresPaymentMethod: true,
        error: 'カード情報の再登録が必要です',
        checkoutUrl: `/checkout?plan=${encodeURIComponent(planId)}&userId=${encodeURIComponent(userId)}`,
      }, { status: 400 });
    }

    const subscription = await createSubscriptionFromToken({
      recurringTokenId: user.recurring_token_id,
      amount: plan.price,
      period: getSubscriptionPeriod(planId),
      metadata: {
        analycaUserId: userId,
        planId,
        planName: plan.name,
        reactivatedAt: new Date().toISOString(),
        previousSubscriptionId: user.subscription_id || '',
      },
    });
    const nextPaymentDate = getNextPaymentDate(subscription);

    await updateUserSubscription(userId, {
      subscription_id: subscription.id,
      plan_id: planId,
      subscription_status: subscription.status || 'current',
      subscription_created_at: new Date(),
      subscription_expires_at: nextPaymentDate,
    });

    const updatedUser = await getUserById(userId);
    if (updatedUser) await syncAnalycaUserRecordToLineHarness(updatedUser);

    return NextResponse.json({
      success: true,
      status: subscription.status,
      subscriptionId: subscription.id,
      nextPaymentDate: nextPaymentDate?.toISOString() || null,
    });
  } catch (error) {
    console.error('[subscription/reactivate] failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '再契約に失敗しました',
    }, { status: 500 });
  }
}
