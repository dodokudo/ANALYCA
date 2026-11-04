import { NextResponse } from 'next/server.js';
import { buildYokoDailyFlex, previousJstDay } from '@/lib/yoko-daily-report';
import { getYokoDailyReport } from '@/lib/yoko-daily-report-data';
import { deliverDailyReport, requestDailyFlex } from '@/lib/yoko-daily-report-delivery';
import { YOKO_DAILY_REPORT_DESTINATION, YOKO_DAILY_REPORT_ENABLED, YOKO_DAILY_REPORT_START_AT } from '@/lib/yoko-daily-report-config';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  const dryRun = new URL(request.url).searchParams.get('dryRun') === 'true';
  const now = new Date(Date.now());
  if (!dryRun && !YOKO_DAILY_REPORT_ENABLED) return NextResponse.json({ sent: false, enabled: false, reason: '送信先の確認待ち' }, { headers });
  if (!dryRun && now.getTime() < new Date(YOKO_DAILY_REPORT_START_AT).getTime()) {
    return NextResponse.json({ sent: false, enabled: true, startsAt: YOKO_DAILY_REPORT_START_AT, reason: '通知開始日時前' }, { headers });
  }
  try {
    const date = previousJstDay(now);
    const report = await getYokoDailyReport(date);
    const message = buildYokoDailyFlex(report);
    if (dryRun) {
      const validation = await requestDailyFlex(YOKO_DAILY_REPORT_DESTINATION, date, message, true);
      return NextResponse.json({ sent: false, enabled: YOKO_DAILY_REPORT_ENABLED, destination: YOKO_DAILY_REPORT_DESTINATION, report, message, validation }, { headers });
    }
    const result = await deliverDailyReport(YOKO_DAILY_REPORT_DESTINATION, date, message);
    return NextResponse.json({ date, ...result }, { headers, status: result.delivery?.state === 'sent' ? 200 : 503 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '日次通知に失敗しました';
    console.error('[yoko-daily-report]', message);
    return NextResponse.json({ error: message }, { status: 503, headers });
  }
}
