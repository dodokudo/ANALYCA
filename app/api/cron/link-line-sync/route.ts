import { NextRequest, NextResponse } from 'next/server';
import { listActiveLineSettings, syncLineFriendsForUser } from '@/lib/link-line-option';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const settings = await listActiveLineSettings();
    let successCount = 0;
    const failures: Array<{ userId: string; error: string }> = [];

    for (const setting of settings) {
      try {
        await syncLineFriendsForUser(setting);
        successCount += 1;
      } catch (error) {
        failures.push({
          userId: setting.userId,
          error: error instanceof Error ? error.message : 'LINE友だち数の取得に失敗しました',
        });
      }
    }

    return NextResponse.json({
      success: failures.length === 0,
      total: settings.length,
      successCount,
      failureCount: failures.length,
      failures,
    });
  } catch (error) {
    console.error('[link-line-option/cron] failed:', error);
    return NextResponse.json(
      { success: false, error: 'LINE友だち数の日次取得に失敗しました' },
      { status: 500 },
    );
  }
}
