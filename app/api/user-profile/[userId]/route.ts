import { NextRequest, NextResponse } from 'next/server';
import { getUserToken } from '@/lib/bigquery';
import { InstagramAPI } from '@/lib/instagram';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    // ユーザーのトークンを取得
    const accessToken = await getUserToken(userId);

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'アクセストークンが見つかりません'
      }, { status: 401 });
    }

    // Instagram APIでプロフィール情報を取得
    const instagram = new InstagramAPI(accessToken);
    const profile = await instagram.getInstagramAccount();

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        username: profile.username,
        name: profile.name || profile.username,
        profile_picture_url: profile.profile_picture_url,
        followers_count: profile.followers_count,
        follows_count: profile.follows_count,
        media_count: profile.media_count,
        biography: profile.biography,
        website: profile.website
      }
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({
      success: false,
      error: 'プロフィール情報の取得に失敗しました',
      details: error instanceof Error ? error.message : '不明なエラー'
    }, { status: 500 });
  }
}