import { NextRequest, NextResponse } from 'next/server';
import { getUserById } from '@/lib/bigquery';
import { collectAll } from '@/lib/researchCollector';
import { isResearchAllowed } from '@/lib/research-access';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (!isResearchAllowed(body.userId)) {
      return NextResponse.json({ error: '対象外のアカウントです' }, { status: 403 });
    }

    // getUserToken() returns the Instagram token; the discovery endpoints need the
    // Threads one, which also has to carry threads_profile_discovery.
    const user = await getUserById(body.userId);
    const accessToken = user?.threads_access_token;
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Threadsのアクセストークンが見つかりません。再連携してください' },
        { status: 400 }
      );
    }

    const result = await collectAll(body.userId, accessToken, {
      username: typeof body.username === 'string' ? body.username : undefined,
      maxPosts: typeof body.maxPosts === 'number' ? body.maxPosts : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[research/collect] failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '収集に失敗しました' },
      { status: 500 }
    );
  }
}
