import { NextRequest, NextResponse } from 'next/server';
import { getUserById, updateUserPaymentToken, updateUserSubscription } from '@/lib/bigquery';
import { getSubscription, updateSubscription } from '@/lib/univapay/client';

const UPDATABLE_STATUSES = new Set(['trial', 'current', 'active', 'unpaid', 'unconfirmed', 'suspended']);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = typeof body?.userId === 'string' ? body.userId : '';
    const transactionTokenId = typeof body?.transactionTokenId === 'string' ? body.transactionTokenId : '';

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }
    if (!transactionTokenId) {
      return NextResponse.json({ success: false, error: 'transactionTokenId is required' }, { status: 400 });
    }

    const user = await getUserById(userId);
    if (!user?.subscription_id) {
      return NextResponse.json({ success: false, error: '有効なサブスクリプションが見つかりません' }, { status: 404 });
    }
    if (!UPDATABLE_STATUSES.has(user.subscription_status || '')) {
      return NextResponse.json({ success: false, error: '現在の契約状態ではカード変更できません' }, { status: 400 });
    }

    const subscription = await getSubscription(user.subscription_id);
    const updated = await updateSubscription(user.subscription_id, {
      transaction_token_id: transactionTokenId,
      ...(user.subscription_status === 'suspended'
        ? { status: 'unpaid' as const, next_payment: { terminate_with_status: '' as const } }
        : {}),
      metadata: {
        ...(subscription.metadata || {}),
        analycaUserId: userId,
        paymentMethodUpdatedAt: new Date().toISOString(),
      },
    });

    await updateUserPaymentToken(userId, transactionTokenId);
    if (user.subscription_status === 'suspended' || user.subscription_status === 'unconfirmed') {
      await updateUserSubscription(userId, {
        subscription_status: updated.status || 'unpaid',
        subscription_expires_at: updated.next_payment_date ? new Date(updated.next_payment_date) : null,
      });
    }

    return NextResponse.json({
      success: true,
      subscriptionId: updated.id,
      status: updated.status,
    });
  } catch (error) {
    console.error('[subscription/payment-method] update failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'カード変更に失敗しました',
    }, { status: 500 });
  }
}
