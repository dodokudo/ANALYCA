import { NextResponse } from 'next/server.js';
import { isAgencyAccount } from '@/lib/agency-accounts';
import { ReflectionConflict } from '@/lib/report-reflection-repository';
import { parseRewriteWrite } from '@/lib/report-rewrite';
import { rewriteRepository } from '@/lib/report-rewrite-repository';
import { getReportMonths } from '@/lib/threads-monthly-report';

export const runtime = 'nodejs';
export const maxDuration = 60;
type Context = { params: Promise<{ userId: string; month: string }> };
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
function json(data: unknown, status = 200): NextResponse { return NextResponse.json(data, { status, headers }); }

export async function GET(_request: Request, context: Context): Promise<NextResponse> {
  const { userId, month } = await context.params;
  if (!isAgencyAccount(userId) || !getReportMonths().includes(month)) return json({ error: '対象のレポートがありません' }, 404);
  try { return json(await rewriteRepository().read(userId, month)); }
  catch (error) {
    console.error('[report-rewrite] read failed', error);
    return json({ error: '書き直し版を読み込めませんでした。時間をおいて再読み込みしてください' }, 503);
  }
}

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'この画面から保存してください' }, 403);
  const { userId, month } = await context.params;
  if (!isAgencyAccount(userId) || !getReportMonths().includes(month)) return json({ error: '対象のレポートがありません' }, 404);
  let input;
  try {
    const text = await request.text();
    if (text.length > 250000) return json({ error: '入力が長すぎます' }, 400);
    input = parseRewriteWrite(JSON.parse(text));
  } catch (error) { return json({ error: error instanceof Error ? error.message : '入力を確認してください' }, 400); }
  try { return json({ saved: await rewriteRepository().save(userId, month, input) }); }
  catch (error) {
    if (error instanceof ReflectionConflict) return json({ error: error.message }, 409);
    console.error('[report-rewrite] save failed', error);
    return json({ error: '保存を確認できませんでした。入力内容を保持しています。再試行してください' }, 503);
  }
}
