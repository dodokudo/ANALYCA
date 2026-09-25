import { NextResponse } from 'next/server';
import { generateMediaDraft } from '@/lib/media/ai';
import { getMediaAdminUserId } from '@/lib/media/auth';

export async function POST(request: Request) {
  const userId = await getMediaAdminUserId();
  if (!userId) return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const draft = await generateMediaDraft({
      topic: typeof body.topic === 'string' ? body.topic : '',
      audience: typeof body.audience === 'string' ? body.audience : '',
      angle: typeof body.angle === 'string' ? body.angle : '',
      keywords: Array.isArray(body.keywords) ? body.keywords.filter((item): item is string => typeof item === 'string') : [],
      sourceUrls: Array.isArray(body.sourceUrls) ? body.sourceUrls.filter((item): item is string => typeof item === 'string') : [],
    });
    return NextResponse.json({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : '記事を生成できませんでした';
    console.error('[admin/media/generate] failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
