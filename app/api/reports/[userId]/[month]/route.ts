import { NextResponse } from 'next/server.js';
import { isAgencyAccount } from '@/lib/agency-accounts';
import { reflectionRepository } from '@/lib/report-reflection-repository';
import { getReportMonths } from '@/lib/threads-monthly-report';

export const runtime = 'nodejs';
export const maxDuration = 60;
type Context = { params: Promise<{ userId: string; month: string }> };
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
function json(data: unknown, status = 200): NextResponse { return NextResponse.json(data, { status, headers }); }

export async function GET(request: Request, context: Context): Promise<NextResponse> {
  const { userId, month } = await context.params;
  if (!isAgencyAccount(userId) || !getReportMonths().includes(month)) return json({ error: '対象のレポートがありません' }, 404);
  try {
    const store = reflectionRepository();
    const revisions = await store.read(userId, month);
    return json({ current: revisions[0] ?? null });
  } catch (error) {
    console.error('[report-reflection] read failed', error);
    return json({ error: '振り返りを読み込めませんでした。時間をおいて再読み込みしてください' }, 503);
  }
}

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  const origin = request.headers.get('origin');
  if (origin !== new URL(request.url).origin) return json({ error: 'この画面から保存してください' }, 403);
  const { userId, month } = await context.params;
  if (!isAgencyAccount(userId) || !getReportMonths().includes(month)) return json({ error: '対象のレポートがありません' }, 404);
  // Freeze the original, including requests from browser tabs opened before this release.
  return json({ error: '当初の原文は保管済みで変更できません。画面を再読み込みし、書き直し版に入力してください' }, 409);
}
