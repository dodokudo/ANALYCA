import { NextResponse } from 'next/server';
import { recordMediaEvent } from '@/lib/media/repository';

const EVENT_TYPES = new Set(['page_view', 'cta_click', 'related_click', 'social_click']);

function short(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const eventType = short(body.eventType, 40);
    if (!EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ error: 'eventTypeが不正です' }, { status: 400 });
    }
    const userAgent = short(request.headers.get('user-agent'), 600);
    if (/bot|crawler|spider|preview/i.test(userAgent)) {
      return new NextResponse(null, { status: 204 });
    }
    await recordMediaEvent({
      eventType: eventType as 'page_view' | 'cta_click' | 'related_click' | 'social_click',
      articleId: short(body.articleId, 120),
      placement: short(body.placement, 120),
      targetUrl: short(body.targetUrl, 2_000),
      sessionId: short(body.sessionId, 120),
      path: short(body.path, 1_000),
      referrer: short(body.referrer, 2_000),
      userAgent,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[media/events] failed', error);
    return NextResponse.json({ error: '計測に失敗しました' }, { status: 500 });
  }
}
