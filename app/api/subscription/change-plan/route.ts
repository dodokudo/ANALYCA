import { NextRequest, NextResponse } from 'next/server';
import { hasValidAnalycaSession } from '@/lib/analyca-session';
import {
  PlanChangeValidationError,
  scheduleSubscriptionPlanChange,
} from '@/lib/subscription-plan-change';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = typeof body?.userId === 'string' ? body.userId : '';
    const targetPlanId = typeof body?.targetPlanId === 'string' ? body.targetPlanId : '';

    if (!userId || !targetPlanId) {
      return NextResponse.json(
        { success: false, error: 'userId and targetPlanId are required' },
        { status: 400 },
      );
    }

    if (!hasValidAnalycaSession(request, userId)) {
      return NextResponse.json(
        {
          success: false,
          error: '安全にプランを変更するため、SNSアカウントで本人確認をしてください',
          requiresReauthentication: true,
        },
        { status: 401 },
      );
    }

    const result = await scheduleSubscriptionPlanChange(userId, targetPlanId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[subscription/change-plan] failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'プラン変更に失敗しました',
      },
      { status: error instanceof PlanChangeValidationError ? 400 : 500 },
    );
  }
}
