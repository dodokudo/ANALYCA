import { NextRequest, NextResponse } from 'next/server';
import { getUserSubscriptionStatus, updateUserSubscription } from '@/lib/bigquery';
import { cancelSubscription, getSubscription } from '@/lib/univapay/client';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    const subStatus = await getUserSubscriptionStatus(userId);

    if (!subStatus.subscription_id) {
      return NextResponse.json({ success: false, error: 'No active subscription' }, { status: 400 });
    }

    if (subStatus.subscription_status === 'canceled') {
      return NextResponse.json({ success: false, error: 'Already canceled' }, { status: 400 });
    }

    // UnivaPay APIでキャンセル
    await cancelSubscription(subStatus.subscription_id);

    // UnivaPayからサブスク情報取得して次回課金日を取得
    let expiresAt: Date | undefined;
    try {
      const sub = await getSubscription(subStatus.subscription_id);
      if (sub.next_payment_date) {
        expiresAt = new Date(sub.next_payment_date);
      }
    } catch {
      // 取得失敗しても解約自体は成功しているのでOK
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    // BigQuery更新
    await updateUserSubscription(userId, {
      subscription_status: 'canceled',
      subscription_expires_at: expiresAt,
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription canceled',
      expires_at: expiresAt?.toISOString(),
    });
  } catch (error) {
    console.error('Subscription cancel error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel',
    }, { status: 500 });
  }
}
