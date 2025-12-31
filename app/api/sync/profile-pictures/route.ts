import { NextResponse } from 'next/server';
import { getActiveInstagramUsers, getActiveThreadsUsers, updateUserProfilePictures } from '@/lib/bigquery';
import { uploadImageToDrive } from '@/lib/google-drive';

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
    if (!response.ok) return null;
    const data = await response.json();
    return data.profile_picture_url || null;
  } catch {
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
    if (!response.ok) return null;
    const data = await response.json();
    return data.threads_profile_picture_url || null;
  } catch {
    return null;
  }
}

/**
 * GET: 全ユーザーのプロフィール画像を同期
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
    }> = [];

    // ユーザーIDの重複を除去して統合
    const allUserIds = new Set<string>();
    igUsers.forEach(u => allUserIds.add(u.user_id));
    threadsUsers.forEach(u => allUserIds.add(u.user_id));

    for (const userId of allUserIds) {
      const igUser = igUsers.find(u => u.user_id === userId);
      const threadsUser = threadsUsers.find(u => u.user_id === userId);

      let igDriveUrl: string | null = null;
      let threadsDriveUrl: string | null = null;

      // Instagram プロフィール画像
      if (igUser?.access_token && igUser?.instagram_user_id) {
        const igPicUrl = await getInstagramProfilePicture(igUser.access_token, igUser.instagram_user_id);
        if (igPicUrl) {
          igDriveUrl = await uploadImageToDrive(igPicUrl, `ig_profile_${userId}`);
        }
      }

      // Threads プロフィール画像
      if (threadsUser?.threads_access_token) {
        const threadsPicUrl = await getThreadsProfilePicture(threadsUser.threads_access_token);
        if (threadsPicUrl) {
          threadsDriveUrl = await uploadImageToDrive(threadsPicUrl, `threads_profile_${userId}`);
        }
      }

      // DB更新
      if (igDriveUrl || threadsDriveUrl) {
        await updateUserProfilePictures(userId, igDriveUrl, threadsDriveUrl);
      }

      results.push({
        userId,
        instagram: !!igDriveUrl,
        threads: !!threadsDriveUrl,
      });

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return NextResponse.json({
      success: true,
      message: `Updated profile pictures for ${results.length} users`,
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
