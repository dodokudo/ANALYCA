import { NextRequest, NextResponse } from 'next/server';
import { createSubscription } from '@/lib/univapay/client';
import { PLANS } from '@/lib/univapay/plans';
import { createPendingUser, getAffiliateByCode, createReferral, recordConversionEvent } from '@/lib/bigquery';
import { v4 as uuidv4 } from 'uuid';
import { sendPaymentCompleteEmail } from '@/lib/email';

// トライアル日数（将来トグルで切り替え可能にする想定）
const TRIAL_ENABLED = true;
const TRIAL_DAYS = 7;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionTokenId, planId, refCode, utm_source, utm_medium, utm_campaign, utm_content, email } = body;

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
    const isTrial = TRIAL_ENABLED;
    const isYearly = plan.yearly === true;
    const userId = uuidv4();

    // UnivaPayでサブスクリプション作成
    const subscriptionParams: Parameters<typeof createSubscription>[0] = {
      transaction_token_id: transactionTokenId,
      amount: plan.price,
      currency: 'JPY',
      period: isYearly ? 'yearly' : 'monthly',
      metadata: {
        analycaUserId: userId,
        planId,
        planName: plan.name,
      },
    };

    if (isTrial) {
      // 7日後に初回課金開始（それまでは無料）
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + TRIAL_DAYS);
      const startOnStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
      subscriptionParams.initial_amount = 0;
      subscriptionParams.schedule_settings = {
        start_on: startOnStr,
      };
    }

    const subscription = await createSubscription(subscriptionParams);

    console.log('Subscription created:', subscription.id, subscription.status, isTrial ? '(trial)' : '');

    // BigQueryに仮ユーザーを作成
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

    await createPendingUser(userId, {
      subscription_id: subscription.id,
      plan_id: planId,
      subscription_status: isTrial ? 'trial' : 'current',
      subscription_created_at: new Date(),
      email: email || undefined,
      ...(isTrial ? { trial_ends_at: trialEndsAt } : {}),
    });

    console.log('Pending user created:', userId, isTrial ? `(trial until ${trialEndsAt.toISOString()})` : '');

    // 決済完了メール送信（非ブロッキング）
    if (email) {
      sendPaymentCompleteEmail(
        email,
        plan.name,
        `https://analyca.jp${plan.onboardingPath}?userId=${userId}`,
      ).catch(err => console.error('Payment email send failed:', err));
    }

    // 紹介コードがあればコミッション記録（トライアルの場合はpendingで記録）
    if (refCode) {
      try {
        const affiliate = await getAffiliateByCode(refCode);
        if (affiliate && affiliate.user_id !== userId) {
          const commissionAmount = Math.floor(plan.price * affiliate.commission_rate);
          await createReferral({
            id: uuidv4(),
            affiliate_code: refCode,
            referred_user_id: userId,
            plan_id: planId,
            payment_amount: plan.price,
            commission_amount: commissionAmount,
          });
          console.log('Referral recorded:', refCode, commissionAmount, isTrial ? '(pending - trial)' : '(pending)');
        }
      } catch (refErr) {
        console.error('Referral recording failed (non-blocking):', refErr);
      }
    }

    // コンバージョンイベントを記録
    try {
      await recordConversionEvent({
        id: uuidv4(),
        user_id: userId,
        event_type: isTrial ? 'trial_start' : 'purchase',
        plan_id: planId,
        amount: isTrial ? 0 : plan.price,
        affiliate_code: refCode || '',
        utm_source: utm_source || '',
        utm_medium: utm_medium || '',
        utm_campaign: utm_campaign || '',
        utm_content: utm_content || '',
        referrer: '',
      });
    } catch (convErr) {
      console.error('Conversion event recording failed (non-blocking):', convErr);
    }

    // サブスクリプション作成成功
    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      status: subscription.status,
      userId,
      isTrial,
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
