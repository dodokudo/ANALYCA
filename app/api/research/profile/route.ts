import { NextRequest, NextResponse } from 'next/server';
import { getUserById } from '@/lib/bigquery';
import { ThreadsDiscoveryAPI } from '@/lib/threadsDiscovery';
import { isResearchAllowed } from '@/lib/research-access';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Look up one public profile and its recent public posts, and return them directly.
 *
 * Nothing is persisted: the operator types a username, sees the result, and moves on.
 * That keeps the surface identical to what the permission actually does, which is what
 * an App Review screencast needs to show.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const userId = searchParams.get('userId');
  if (!isResearchAllowed(userId)) {
    return NextResponse.json({ error: '対象外のアカウントです' }, { status: 403 });
  }

  const username = (searchParams.get('username') || '').trim();
  if (!username) {
    return NextResponse.json({ error: 'usernameを入力してください' }, { status: 400 });
  }

  try {
    const user = await getUserById(userId);
    const accessToken = user?.threads_access_token;
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Threadsのアクセストークンが見つかりません。再連携してください' },
        { status: 400 }
      );
    }

    const discovery = new ThreadsDiscoveryAPI(accessToken);

    const clean = username.replace(/^@/, '').replace(/^https?:\/\/(www\.)?threads\.(net|com)\//i, '').split(/[/?#]/)[0];
    const profile = await discovery.profileLookup(clean);
    const rawPosts = await discovery.getProfilePosts(clean, 15);

    // Reply chains are loaded per post via /api/research/thread, so this stays fast.
    const posts = rawPosts.map((post) => ({
      id: post.id,
      text: post.text ?? '',
      timestamp: post.timestamp,
      permalink: post.permalink ?? '',
      mediaType: post.media_type ?? '',
      textLength: [...(post.text ?? '')].length,
      hasReplies: post.has_replies !== false,
    }));

    return NextResponse.json({ profile, posts });
  } catch (error) {
    const message = error instanceof Error ? error.message : '取得に失敗しました';
    console.error('[research/profile] failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
