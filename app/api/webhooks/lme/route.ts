import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;
const receiver = 'https://guardian-webhook-zdpkrgcsua-an.a.run.app/api/webhooks/lme';

export function GET() {
  return NextResponse.json({ service: 'lme-compatibility-relay', owner: 'Guardian', receiver, version: 'guardian-course-v1' });
}

// Compatibility for in-flight deliveries to the old URL. Authentication,
// persistence and business processing belong exclusively to Guardian.
export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-lme-signature');
  if (!signature) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.text();
  if (Buffer.byteLength(body) > 1_000_000) return NextResponse.json({ error: 'Too large' }, { status: 413 });
  try {
    const response = await fetch(receiver, {
      method: 'POST', signal: AbortSignal.timeout(20_000), redirect: 'error',
      headers: { 'Content-Type': 'application/json', 'x-lme-signature': signature, 'x-lme-delivery-id': request.headers.get('x-lme-delivery-id') || '' },
      body,
    });
    return new NextResponse(await response.text(), { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Guardian temporarily unavailable' }, { status: 503 }); }
}
