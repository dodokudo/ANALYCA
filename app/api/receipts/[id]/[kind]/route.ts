import { NextRequest, NextResponse } from 'next/server';
import { kindsFor, validDownloadToken, type Issue, type DocumentKind } from '@/lib/receipts/domain';
import { readRecord, receiptBucket } from '@/lib/receipts/store';

export const runtime = 'nodejs';
export async function GET(request: NextRequest, context: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await context.params;
  const notFound = () => NextResponse.json({ error: 'ダウンロードリンクの有効期限が切れています。発行ページから再度お手続きください。' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  if (!/^[a-f0-9]{64}$/.test(id) || !['receipt', 'invoice'].includes(kind) || !validDownloadToken(id, request.nextUrl.searchParams.get('token') || '')) return notFound();
  const record = await readRecord<Issue>(`issues/${id}.json`);
  if (!record || !kindsFor(record.value.method).includes(kind as DocumentKind)) return notFound();
  const doc = record.value.documents[kind as DocumentKind];
  if (!doc) return notFound();
  const [bytes] = await (await receiptBucket()).file(doc.path).download();
  return new NextResponse(new Uint8Array(bytes), { headers: {
    'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${kind}.pdf"; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  } });
}
