import { NextRequest, NextResponse } from 'next/server';
import {
  executeSubscriptionUpgrade,
  getSubscriptionUpgradeQuote,
  SubscriptionUpgradeValidationError,
} from '@/lib/subscription-upgrade';

function errorResponse(error: unknown) {
  console.error('[subscription/upgrade] failed:', error);
  return NextResponse.json(
    {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upgrade subscription',
    },
    { status: error instanceof SubscriptionUpgradeValidationError ? 400 : 500 },
  );
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  const targetPlanId = request.nextUrl.searchParams.get('targetPlanId');
  if (!userId || !targetPlanId) {
    return NextResponse.json(
      { success: false, error: 'userId and targetPlanId are required' },
      { status: 400 },
    );
  }

  try {
    const quote = await getSubscriptionUpgradeQuote(userId, targetPlanId);
    return NextResponse.json({ success: true, ...quote });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, targetPlanId } = await request.json();
    if (!userId || !targetPlanId) {
      return NextResponse.json(
        { success: false, error: 'userId and targetPlanId are required' },
        { status: 400 },
      );
    }

    const result = await executeSubscriptionUpgrade(userId, targetPlanId);
    return NextResponse.json(result, { status: result.processing ? 202 : 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
