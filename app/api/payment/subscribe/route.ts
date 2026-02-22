import { NextRequest, NextResponse } from 'next/server';
import { createSubscription } from '@/lib/univapay/client';
import { PLANS } from '@/lib/univapay/plans';
import { createPendingUser } from '@/lib/bigquery';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionTokenId, planId } = body;

    if (!transactionTokenId) {
      return NextResponse.json({
        success: false,
        error: 'Transaction token is required',
      }, { status: 400 });
    }

    if (!planId || !PLANS[planId]) {
      return NextResponse.json({
        success: false,
        error: 'Invalid plan ID',
      }, { status: 400 });
    }

    const plan = PLANS[planId];

    // UnivaPayでサブスクリプション作成
    const subscription = await createSubscription({
      transaction_token_id: transactionTokenId,
      amount: plan.price,
      currency: 'JPY',
      period: 'monthly',
      metadata: {
        planId: planId,
        planName: plan.name,
      },
    });

    console.log('Subscription created:', subscription.id, subscription.status);

    // BigQueryに仮ユーザーを作成（サブスクリプション情報を紐付け）
    const userId = uuidv4();
    await createPendingUser(userId, {
      subscription_id: subscription.id,
      plan_id: planId,
      subscription_status: 'active',
      subscription_created_at: new Date(),
    });

    console.log('Pending user created:', userId);

    // サブスクリプション作成成功
    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      status: subscription.status,
      userId,
      onboardingPath: `${plan.onboardingPath}?userId=${userId}`,
    });

  } catch (error) {
    console.error('Subscription error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create subscription',
    }, { status: 500 });
  }
}
