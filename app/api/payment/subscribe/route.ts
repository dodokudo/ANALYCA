import { NextRequest, NextResponse } from 'next/server';
import { createSubscription } from '@/lib/univapay/client';

// プラン定義
const PLANS: Record<string, {
  name: string;
  price: number;
  onboardingPath: string;
}> = {
  'light-threads': {
    name: 'Light (Threads)',
    price: 4980,
    onboardingPath: '/onboarding/light',
  },
  'light-instagram': {
    name: 'Light (Instagram)',
    price: 4980,
    onboardingPath: '/onboarding/light2',
  },
  'standard': {
    name: 'Standard',
    price: 9800,
    onboardingPath: '/onboarding/standard',
  },
};

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

    // サブスクリプション作成成功
    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      status: subscription.status,
      onboardingPath: plan.onboardingPath,
    });

  } catch (error) {
    console.error('Subscription error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create subscription',
    }, { status: 500 });
  }
}
