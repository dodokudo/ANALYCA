import { NextRequest, NextResponse } from 'next/server';
import { nextMonthToPrepare } from '@/lib/receipts/domain';
import { ensureMonthFolders } from '@/lib/receipts/drive';
import { deliverIssue } from '@/lib/receipts/service';
import { receiptBucket, readRecord, writeRecord } from '@/lib/receipts/store';

export const runtime = 'nodejs';
export const maxDuration = 120;
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (process.env.RECEIPTS_ENABLED !== 'true') return NextResponse.json({ skipped: 'disabled' });
  const month = nextMonthToPrepare();
  let prepared = false;
  const errors: string[] = [];
  if (month) {
    try {
      if (!await readRecord(`months/${month}.json`)) {
        const folders = await ensureMonthFolders(month);
        await writeRecord(`months/${month}.json`, { month, folders, preparedAt: new Date().toISOString() }).catch(e => { if (e.code !== 412) throw e; });
      }
      prepared = true;
    } catch { errors.push('folder-preparation'); }
  }
  const bucket = await receiptBucket();
  const previous = await readRecord<{ cursor?: string }>('jobs/latest.json');
  const [pending, nextQuery] = await bucket.getFiles({ prefix: 'pending/', maxResults: 5, autoPaginate: false, pageToken: previous?.value.cursor });
  let processed = 0;
  for (const file of pending) {
    if (processed >= 5) break;
    try { await deliverIssue(file.name.split('/').pop()!.replace('.json', '')); processed++; }
    catch { errors.push(file.name); }
  }
  const result = { at: new Date().toISOString(), month, prepared, processed, errors, cursor: nextQuery?.pageToken || null };
  await writeRecord('jobs/latest.json', result, previous?.generation || 0);
  return NextResponse.json(result, { status: errors.length ? 503 : 200 });
}
