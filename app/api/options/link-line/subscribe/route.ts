import { NextRequest, NextResponse } from 'next/server';
import { getUserById } from '@/lib/bigquery';
import {
  getLinkLineOptionRecord,
  getLinkLineOptionStatus,
  LINK_LINE_OPTION_CODE,
  LINK_LINE_OPTION_NAME,
  LINK_LINE_OPTION_PRICE,
  upsertLinkLineOptionSubscription,
  userHasLinkLineOptionAccess,
} from '@/lib/link-line-option';
import { createSubscriptionFromToken } from '@/lib/univapay/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    const requestId = typeof body?.requestId === 'string' ? body.requestId.trim() : '';
    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    const [user, currentOption] = await Promise.all([
      getUserById(userId),
      getLinkLineOptionRecord(userId),
    ]);
    if (!user) {
      return NextResponse.json({ success: false, error: 'ユーザーが見つかりません' }, { status: 404 });
    }
    if (userHasLinkLineOptionAccess(userId, currentOption)) {
      return NextResponse.json({
        success: true,
        alreadyActive: true,
        option: await getLinkLineOptionStatus(userId),
      });
    }

    const baseStatus = (user.subscription_status || '').toLowerCase();
    if (!['current', 'active', 'trial'].includes(baseStatus)) {
      return NextResponse.json(
        { success: false, error: 'オプション契約には有効なANALYCAプランが必要です' },
        { status: 409 },
      );
    }
    if (!user.recurring_token_id) {
      return NextResponse.json(
        {
          success: false,
          requiresPaymentMethod: true,
          error: '先にカード情報を登録してください',
        },
        { status: 400 },
      );
    }

    const subscription = await createSubscriptionFromToken({
      recurringTokenId: user.recurring_token_id,
      amount: LINK_LINE_OPTION_PRICE,
      period: 'monthly',
      metadata: {
        analycaUserId: userId,
        optionCode: LINK_LINE_OPTION_CODE,
        optionName: LINK_LINE_OPTION_NAME,
      },
      idempotencyKey: requestId
        ? `analyca-option-${LINK_LINE_OPTION_CODE}-${userId}-${requestId}`
        : undefined,
    });
    const rawNextPayment = subscription.next_payment_date || subscription.next_payment?.due_date;
    const expiresAt = rawNextPayment ? new Date(rawNextPayment) : null;

    await upsertLinkLineOptionSubscription({
      userId,
      subscriptionId: subscription.id,
      status: subscription.status || 'current',
      startedAt: new Date(),
      expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
    });

    return NextResponse.json({
      success: true,
      option: await getLinkLineOptionStatus(userId),
    });
  } catch (error) {
    console.error('[link-line-option/subscribe] failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'オプション契約に失敗しました',
      },
      { status: 500 },
    );
  }
}
