import { NextRequest, NextResponse } from 'next/server';
import {
  cancelScheduledSubscriptionPlanChange,
  PlanChangeValidationError,
} from '@/lib/subscription-plan-change';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }
    const message = await cancelScheduledSubscriptionPlanChange(userId);
    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error('[subscription/change-plan/cancel] failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel plan change',
      },
      { status: error instanceof PlanChangeValidationError ? 400 : 500 },
    );
  }
}
