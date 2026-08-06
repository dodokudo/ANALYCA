import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { syncAllYokoNotionContent, syncYokoNotionContentBatch } from '@/lib/yoko-notion-sync';
import type { YokoNotionSourceType } from '@/lib/yoko-notion-ledger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(request: NextRequest) {
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const expectedSecrets = [
    process.env.YOKO_SYNC_SECRET,
    process.env.ANALYCA_SESSION_SECRET,
  ].filter((value): value is string => Boolean(value));
  if (!supplied) return false;
  const suppliedBuffer = Buffer.from(supplied);
  return expectedSecrets.some((expected) => {
    const expectedBuffer = Buffer.from(expected);
    return expectedBuffer.length === suppliedBuffer.length
      && timingSafeEqual(expectedBuffer, suppliedBuffer);
  });
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({})) as {
      mode?: string;
      sourceType?: YokoNotionSourceType;
      limit?: number;
    };
    if (body.mode === 'batch') {
      if (!['instagram_script', 'gem_knowledge'].includes(body.sourceType || '')) {
        return NextResponse.json({ error: 'sourceType is required' }, { status: 400 });
      }
      const result = await syncYokoNotionContentBatch(body.sourceType!, body.limit || 75);
      return NextResponse.json(result);
    }
    const result = await syncAllYokoNotionContent();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[notion/yoko/sync] failed', error);
    return NextResponse.json({ error: 'YOKO Notion sync failed' }, { status: 500 });
  }
}
