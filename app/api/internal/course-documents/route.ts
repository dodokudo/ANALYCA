import { after, NextRequest, NextResponse } from 'next/server';
import { authorizedDocumentTool, parseDocumentRequest } from '@/lib/receipts/course-tool';
import { downloadToken, ReceiptError } from '@/lib/receipts/domain';
import { deliverIssue, issueDocuments } from '@/lib/receipts/service';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  if (!authorizedDocumentTool(request.headers.get('authorization'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (process.env.RECEIPTS_ENABLED !== 'true') return NextResponse.json({ error: 'Disabled' }, { status: 503 });
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 10_000) return NextResponse.json({ error: 'Too large' }, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
    const { input, sample, course, createdAt } = parseDocumentRequest(body);
    const issue = await issueDocuments(input, sample, course);
    // The persisted pending record and receipt cron recover an interrupted send.
    after(async () => { try { await deliverIssue(issue.id); } catch { console.error('[course-documents] Delivery pending', { id: issue.id }); } });
    const expires = Math.max(createdAt + 30 * 86400_000, Date.now() + 3600_000);
    return NextResponse.json({ id: issue.id, url: `https://analyca.jp/receipts/download/${issue.id}?token=${encodeURIComponent(downloadToken(issue.id, expires))}`, delivery: 'queued' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof ReceiptError ? e.message : 'Document service unavailable' }, { status: e instanceof ReceiptError ? e.status : 503 });
  }
}
