import { NextResponse } from 'next/server';
import { getActiveInstagramUsers, getActiveThreadsUsers, updateUserProfilePictures } from '@/lib/bigquery';
import { uploadImageToGCS } from '@/lib/gcs';
import { detectGraphBase } from '@/lib/instagram-graph';

export const maxDuration = 120;

const THREADS_GRAPH_BASE = 'https://graph.threads.net/v1.0';

/**
 * Instagramプロフィール画像URLを取得してGCSにアップロード
 */
async function getInstagramProfilePicture(accessToken: string, userId: string): Promise<string | null> {
  try {
    const graphBase = await detectGraphBase(accessToken, `/${userId}?fields=id`);
    const response = await fetch(
      `${graphBase}/${userId}?fields=profile_picture_url&access_token=${accessToken}`
    );
    if (!response.ok) {
      console.error(`Instagram profile picture fetch failed: ${response.status}`);
      return null;
    }
    const data = await response.json();
    const cdnUrl = data.profile_picture_url || null;

    if (cdnUrl) {
      // GCSにアップロード
      const fileName = `instagram_profile_${userId}_${Date.now()}`;
      const gcsUrl = await uploadImageToGCS(cdnUrl, fileName, 'profile-pictures/instagram');
      if (gcsUrl) {
        return gcsUrl;
      }
    }

    return cdnUrl;
  } catch (e) {
    console.error('Instagram profile picture error:', e);
    return null;
  }
}

/**
 * Threadsプロフィール画像URLを取得してGCSにアップロード
 */
async function getThreadsProfilePicture(accessToken: string, userId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${THREADS_GRAPH_BASE}/me?fields=threads_profile_picture_url&access_token=${accessToken}`
    );
    if (!response.ok) {
      console.error(`Threads profile picture fetch failed: ${response.status}`);
      return null;
    }
    const data = await response.json();
    const cdnUrl = data.threads_profile_picture_url || null;

    if (cdnUrl) {
      // GCSにアップロード
      const fileName = `threads_profile_${userId}_${Date.now()}`;
      const gcsUrl = await uploadImageToGCS(cdnUrl, fileName, 'profile-pictures/threads');
      if (gcsUrl) {
        return gcsUrl;
      }
    }

    return cdnUrl;
  } catch (e) {
    console.error('Threads profile picture error:', e);
    return null;
  }
}

/**
 * GET: 全ユーザーのプロフィール画像を同期（GCSにアップロードして永続URL保存）
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    let [igUsers, threadsUsers] = await Promise.all([
      getActiveInstagramUsers(),
      getActiveThreadsUsers(),
    ]);

    // userIdが指定されている場合、そのユーザーのみに絞る
    if (targetUserId) {
      igUsers = igUsers.filter(u => u.user_id === targetUserId);
      threadsUsers = threadsUsers.filter(u => u.user_id === targetUserId);
    }

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
          threadsPicUrl = await getThreadsProfilePicture(threadsUser.threads_access_token, userId);
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
