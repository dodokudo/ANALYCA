import { NextRequest, NextResponse } from 'next/server';
import { getTrialExpiredUsersWithCard, expireTrialUsersWithoutCard, updateUserSubscription } from '@/lib/bigquery';
import { createSubscriptionFromToken } from '@/lib/univapay/client';
import { PLANS } from '@/lib/univapay/plans';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Vercel Cronからの呼び出しを確認
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Array<{ userId: string; status: string; error?: string }> = [];

  try {
    // 1. カード登録済みのトライアル期限切れユーザーを有料変換
    const expiredWithCard = await getTrialExpiredUsersWithCard();

    for (const user of expiredWithCard) {
      try {
        const plan = PLANS[user.plan_id];
        if (!plan) {
          results.push({ userId: user.user_id, status: 'skipped', error: `Unknown plan: ${user.plan_id}` });
          continue;
        }

        // UnivaPayでサブスクリプション作成
        const subscription = await createSubscriptionFromToken({
          recurringTokenId: user.recurring_token_id,
          amount: plan.price,
          metadata: { planId: user.plan_id, userId: user.user_id },
        });

        // BigQuery更新
        await updateUserSubscription(user.user_id, {
          subscription_id: subscription.id,
          subscription_status: 'active',
          subscription_created_at: new Date(),
        });

        results.push({ userId: user.user_id, status: 'converted' });
        console.log(`[TRIAL CONVERSION] User ${user.user_id} converted to paid (${user.plan_id})`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        results.push({ userId: user.user_id, status: 'failed', error: errorMsg });
        console.error(`[TRIAL CONVERSION FAILED] User ${user.user_id}:`, err);
      }
    }

    // 2. カード未登録のトライアル期限切れユーザーを期限切れに
    const expiredCount = await expireTrialUsersWithoutCard();
    if (expiredCount > 0) {
      console.log(`[TRIAL EXPIRED] ${expiredCount} users expired (no card registered)`);
    }

    return NextResponse.json({
      success: true,
      converted: results.filter(r => r.status === 'converted').length,
      failed: results.filter(r => r.status === 'failed').length,
      expired: expiredCount,
      details: results,
    });
  } catch (error) {
    console.error('Trial conversion cron error:', error);
    return NextResponse.json(
      { success: false, error: 'Cron job failed' },
      { status: 500 }
    );
  }
}
