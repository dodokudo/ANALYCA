import { NextRequest, NextResponse } from 'next/server';
import { getUserSubscriptionStatus } from '@/lib/bigquery';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
  }

  try {
    const status = await getUserSubscriptionStatus(userId);
    return NextResponse.json({ success: true, ...status });
  } catch (error) {
    console.error('Subscription status error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get status' }, { status: 500 });
  }
}
