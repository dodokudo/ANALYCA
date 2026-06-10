import { NextRequest, NextResponse } from 'next/server';
import { insertScheduledPost, listScheduledPosts, toJstIsoString } from '@/lib/bigqueryScheduledPosts';
import { MAX_COMMENT_MEDIA_ITEMS, MAX_THREADS_MEDIA_ITEMS, normalizeThreadsMediaItems, serializeThreadsMediaItems } from '@/lib/threadsMedia';

function validateTextLength(label: string, value?: string) {
  if (!value || value.trim().length === 0) {
    return `${label}は必須です`;
  }
  if (value.length > 500) {
    return `${label}は500文字以内である必要があります`;
  }
  return null;
}

function validateOptionalTextLength(label: string, value?: string) {
  if (!value) return null;
  if (value.length > 500) {
    return `${label}は500文字以内である必要があります`;
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    const startDate = searchParams.get('start') || undefined;
    const endDate = searchParams.get('end') || undefined;

    const items = await listScheduledPosts(userId, { startDate, endDate });
    return NextResponse.json({ items });
  } catch (error) {
    console.error('[schedule/threads] GET failed', error);
    return NextResponse.json({ error: 'Failed to load schedules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const payload = await request.json();
    const { scheduledAt, mainText, comment1, comment2, comment3, comment4, comment5, comment6, comment7, status } = payload ?? {};
    if (Array.isArray(payload?.mediaItems) && payload.mediaItems.length > MAX_THREADS_MEDIA_ITEMS) {
      return NextResponse.json({ error: `メディアは最大${MAX_THREADS_MEDIA_ITEMS}件までです` }, { status: 400 });
    }
    if (Array.isArray(payload?.comment1MediaItems) && payload.comment1MediaItems.length > MAX_COMMENT_MEDIA_ITEMS) {
      return NextResponse.json({ error: `コメント1のメディアは最大${MAX_COMMENT_MEDIA_ITEMS}件までです` }, { status: 400 });
    }
    if (Array.isArray(payload?.comment2MediaItems) && payload.comment2MediaItems.length > MAX_COMMENT_MEDIA_ITEMS) {
      return NextResponse.json({ error: `コメント2のメディアは最大${MAX_COMMENT_MEDIA_ITEMS}件までです` }, { status: 400 });
    }
    const mediaItems = normalizeThreadsMediaItems(payload?.mediaItems);
    const serializedMedia = serializeThreadsMediaItems(mediaItems);
    const serializedComment1Media = serializeThreadsMediaItems(normalizeThreadsMediaItems(payload?.comment1MediaItems));
    const serializedComment2Media = serializeThreadsMediaItems(normalizeThreadsMediaItems(payload?.comment2MediaItems));

    if (!scheduledAt || typeof scheduledAt !== 'string') {
      return NextResponse.json({ error: 'scheduledAt is required' }, { status: 400 });
    }

    const mainError = validateTextLength('メイン投稿', mainText);
    if (mainError) {
      return NextResponse.json({ error: mainError }, { status: 400 });
    }

    const comment1Error = validateOptionalTextLength('コメント1', typeof comment1 === 'string' ? comment1 : undefined);
    if (comment1Error) {
      return NextResponse.json({ error: comment1Error }, { status: 400 });
    }

    const comment2Error = validateOptionalTextLength('コメント2', typeof comment2 === 'string' ? comment2 : undefined);
    if (comment2Error) {
      return NextResponse.json({ error: comment2Error }, { status: 400 });
    }

    for (const [label, value] of [
      ['コメント3', comment3],
      ['コメント4', comment4],
      ['コメント5', comment5],
      ['コメント6', comment6],
      ['コメント7', comment7],
    ] as const) {
      const err = validateOptionalTextLength(label, typeof value === 'string' ? value : undefined);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    const scheduledTimeIso = toJstIsoString(String(scheduledAt));
    if (!scheduledTimeIso) {
      return NextResponse.json({ error: 'scheduledAt is invalid' }, { status: 400 });
    }
    const scheduleId = `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const created = await insertScheduledPost({
      scheduleId,
      userId,
      scheduledTimeIso,
      status: typeof status === 'string' ? status : 'scheduled',
      mainText: String(mainText),
      mainMediaUrls: serializedMedia.urls,
      mainMediaTypes: serializedMedia.types,
      mainMediaAltTexts: serializedMedia.altTexts,
      comment1: typeof comment1 === 'string' ? comment1 : '',
      comment1MediaUrls: serializedComment1Media.urls,
      comment1MediaTypes: serializedComment1Media.types,
      comment1MediaAltTexts: serializedComment1Media.altTexts,
      comment2: typeof comment2 === 'string' ? comment2 : '',
      comment2MediaUrls: serializedComment2Media.urls,
      comment2MediaTypes: serializedComment2Media.types,
      comment2MediaAltTexts: serializedComment2Media.altTexts,
      comment3: typeof comment3 === 'string' ? comment3 : '',
      comment4: typeof comment4 === 'string' ? comment4 : '',
      comment5: typeof comment5 === 'string' ? comment5 : '',
      comment6: typeof comment6 === 'string' ? comment6 : '',
      comment7: typeof comment7 === 'string' ? comment7 : '',
    });

    if (!created) {
      return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
    }

    return NextResponse.json({ item: created });
  } catch (error) {
    console.error('[schedule/threads] POST failed', error);
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
  }
}
