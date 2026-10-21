import { after, NextRequest, NextResponse } from 'next/server';
import { ReceiptError, validateInput } from '@/lib/receipts/domain';
import { deliverIssue, issueDocuments, publicResult } from '@/lib/receipts/service';
import { rateLimit } from '@/lib/receipts/store';

export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: NextRequest) {
  try {
    if (process.env.RECEIPTS_ENABLED !== 'true') throw new ReceiptError('現在、発行の準備中です。時間をおいてお試しください。', 503);
    const origin = request.headers.get('origin');
    if (!origin || new URL(origin).origin !== request.nextUrl.origin) throw new ReceiptError('発行ページからお手続きください。', 403);
    if (Number(request.headers.get('content-length') || 0) > 4096) throw new ReceiptError('入力内容が長すぎます。');
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 4096) throw new ReceiptError('入力内容が長すぎます。');
    let input;
    let sample = false;
    try { const parsed = JSON.parse(raw); input = validateInput(parsed); sample = parsed.sample === true; }
    catch (e) { if (e instanceof ReceiptError) throw e; throw new ReceiptError('入力内容を確認してください。'); }
    if (sample && (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)) throw new ReceiptError('動作確認の認証が必要です。', 403);
    const ip = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    await Promise.all([rateLimit(`ip:${ip}`, 20), rateLimit(`email:${input.email}`, 5)]);
    const started = Date.now();
    const issue = await issueDocuments(input, sample);
    console.info('[receipts] PDFs ready', { id: issue.id, milliseconds: Date.now() - started });
    after(async () => {
      try { await deliverIssue(issue.id); }
      catch (e) {
        // The durable pending record remains available to the retry job.
        console.error('[receipts] Background delivery pending', { id: issue.id, code: (e as { code?: string }).code });
      }
    });
    return NextResponse.json(publicResult(issue), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof ReceiptError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[receipts] Issuance failed', { name: (e as Error).name, code: (e as { code?: string }).code });
    return NextResponse.json({ error: '発行を完了できませんでした。同じ内容でもう一度お試しください。' }, { status: 503 });
  }
}
