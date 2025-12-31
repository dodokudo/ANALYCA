import { NextResponse } from 'next/server';
import { getActiveInstagramUsers, getActiveThreadsUsers, updateUserProfilePictures } from '@/lib/bigquery';

export const maxDuration = 120;

const FACEBOOK_GRAPH_BASE = 'https://graph.facebook.com/v23.0';
const THREADS_GRAPH_BASE = 'https://graph.threads.net/v1.0';

/**
 * Instagramプロフィール画像URLを取得
 */
async function getInstagramProfilePicture(accessToken: string, userId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${FACEBOOK_GRAPH_BASE}/${userId}?fields=profile_picture_url&access_token=${accessToken}`
    );
    if (!response.ok) {
      console.error(`Instagram profile picture fetch failed: ${response.status}`);
      return null;
    }
    const data = await response.json();
    return data.profile_picture_url || null;
  } catch (e) {
    console.error('Instagram profile picture error:', e);
    return null;
  }
}

/**
 * Threadsプロフィール画像URLを取得
 */
async function getThreadsProfilePicture(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${THREADS_GRAPH_BASE}/me?fields=threads_profile_picture_url&access_token=${accessToken}`
    );
    if (!response.ok) {
      console.error(`Threads profile picture fetch failed: ${response.status}`);
      return null;
    }
    const data = await response.json();
    return data.threads_profile_picture_url || null;
  } catch (e) {
    console.error('Threads profile picture error:', e);
    return null;
  }
}

/**
 * GET: 全ユーザーのプロフィール画像を同期（CDN URLを直接保存）
 */
export async function GET() {
  try {
    const [igUsers, threadsUsers] = await Promise.all([
      getActiveInstagramUsers(),
      getActiveThreadsUsers(),
    ]);

    const results: Array<{
      userId: string;
      instagram: boolean;
      threads: boolean;
      error?: string;
    }> = [];

    // ユーザーIDの重複を除去して統合
    const allUserIds = new Set<string>();
    igUsers.forEach(u => allUserIds.add(u.user_id));
    threadsUsers.forEach(u => allUserIds.add(u.user_id));

    for (const userId of allUserIds) {
      const igUser = igUsers.find(u => u.user_id === userId);
      const threadsUser = threadsUsers.find(u => u.user_id === userId);

      let igPicUrl: string | null = null;
      let threadsPicUrl: string | null = null;
      let error: string | undefined;

      try {
        // Instagram プロフィール画像
        if (igUser?.access_token && igUser?.instagram_user_id) {
          igPicUrl = await getInstagramProfilePicture(igUser.access_token, igUser.instagram_user_id);
        }

        // Threads プロフィール画像
        if (threadsUser?.threads_access_token) {
          threadsPicUrl = await getThreadsProfilePicture(threadsUser.threads_access_token);
        }

        // DB更新
        if (igPicUrl || threadsPicUrl) {
          await updateUserProfilePictures(userId, igPicUrl, threadsPicUrl);
        }
      } catch (e) {
        error = e instanceof Error ? e.message : 'Unknown error';
      }

      results.push({
        userId,
        instagram: !!igPicUrl,
        threads: !!threadsPicUrl,
        error,
      });

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const igSuccess = results.filter(r => r.instagram).length;
    const threadsSuccess = results.filter(r => r.threads).length;

    return NextResponse.json({
      success: true,
      message: `Updated profile pictures: Instagram ${igSuccess}, Threads ${threadsSuccess}`,
      results,
    });
  } catch (error) {
    console.error('Profile picture sync error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    }, { status: 500 });
  }
}
