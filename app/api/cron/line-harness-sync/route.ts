import { NextRequest, NextResponse } from 'next/server';
import { getUsersForLineHarnessSync } from '@/lib/bigquery';
import { syncAllAnalycaUsersToLineHarness } from '@/lib/line-harness-sync';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await getUsersForLineHarnessSync();
    const result = await syncAllAnalycaUsersToLineHarness(users);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('LINE Harness sync cron error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'LINE Harness sync failed',
      },
      { status: 500 },
    );
  }
}
