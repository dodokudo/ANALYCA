import { after, NextRequest, NextResponse } from 'next/server';
import { completionFriends, validSignature } from '@/lib/course-applications/domain';
import { processSubmission, queueSubmission } from '@/lib/course-applications/service';

export const runtime = 'nodejs';
export const maxDuration = 120;
export function GET() { return NextResponse.json({ service: 'lme-course-documents', status: 'ready' }); }
export async function POST(request: NextRequest) {
  if (!process.env.LME_WEBHOOK_SECRET) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  if (!validSignature(request.headers.get('x-lme-signature'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (process.env.LME_AUTOMATION_ENABLED !== 'true') return NextResponse.json({ error: 'Disabled' }, { status: 503 });
  const delivery = request.headers.get('x-lme-delivery-id') || '';
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(delivery)) return NextResponse.json({ error: 'Invalid delivery ID' }, { status: 400 });
  const body = await request.text();
  if (Buffer.byteLength(body) > 1_000_000) return NextResponse.json({ error: 'Too large' }, { status: 413 });
  let friends: number[];
  try { friends = completionFriends(JSON.parse(body)); }
  catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  // Persist before acknowledging. Only the dedicated form-completion tag is retained.
  try {
    const tasks = await Promise.all(friends.map(id => queueSubmission(delivery, id)));
    after(async () => { for (const key of tasks) { try { await processSubmission(key); } catch { console.error('[lme] Deferred processing pending', { key }); } } });
    return NextResponse.json({ accepted: tasks.length });
  } catch { return NextResponse.json({ error: 'Try again' }, { status: 503 }); }
}
