import { NextRequest, NextResponse } from 'next/server';
import { retrySubmissions } from '@/lib/course-applications/service';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (process.env.LME_AUTOMATION_ENABLED !== 'true') return NextResponse.json({ skipped: 'disabled' });
  return NextResponse.json(await retrySubmissions());
}
