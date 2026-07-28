import { NextRequest, NextResponse } from 'next/server';
import {
  getLinkLineOptionRecord,
  getLinkLineOptionStatus,
  updateLinkLineOptionBySubscriptionId,
} from '@/lib/link-line-option';
import { cancelSubscription, getSubscription } from '@/lib/univapay/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    const option = await getLinkLineOptionRecord(userId);
    if (!option?.subscriptionId) {
      return NextResponse.json(
        { success: false, error: '有効なオプション契約がありません' },
        { status: 400 },
      );
    }
    if (option.status.toLowerCase() === 'canceled') {
      return NextResponse.json({
        success: true,
        alreadyCanceled: true,
        option: await getLinkLineOptionStatus(userId),
      });
    }

    let expiresAt = option.expiresAt ? new Date(option.expiresAt) : null;
    try {
      const subscription = await getSubscription(option.subscriptionId);
      const rawNextPayment = subscription.next_payment_date || subscription.next_payment?.due_date;
      if (rawNextPayment) {
        const parsed = new Date(rawNextPayment);
        if (!Number.isNaN(parsed.getTime())) expiresAt = parsed;
      }
    } catch (error) {
      console.warn('[link-line-option/cancel] failed to hydrate subscription:', error);
    }

    await cancelSubscription(option.subscriptionId);
    if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
    await updateLinkLineOptionBySubscriptionId({
      subscriptionId: option.subscriptionId,
      status: 'canceled',
      expiresAt,
    });

    return NextResponse.json({
      success: true,
      option: await getLinkLineOptionStatus(userId),
    });
  } catch (error) {
    console.error('[link-line-option/cancel] failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'オプション解約に失敗しました',
      },
      { status: 500 },
    );
  }
}
