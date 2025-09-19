import { NextRequest, NextResponse } from 'next/server';
import { InstagramAPI } from '@/lib/instagram';
import {
  upsertUser,
  insertInstagramReels,
  insertInstagramStories,
  insertInstagramInsights
} from '@/lib/bigquery';

export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json();

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'アクセストークンが提供されていません'
      }, { status: 400 });
    }

    // 1. 短期トークンを長期トークンに変換
    const longTermToken = await InstagramAPI.exchangeForLongTermToken(accessToken);

    // 2. Instagram APIクライアントを初期化
    const instagram = new InstagramAPI(longTermToken);

    // 3. ユーザー情報とドライブフォルダIDを設定から取得
    const driveFolder = process.env.GOOGLE_DRIVE_FOLDER_ID || '1lH92NxycLKE4adG3hlURhIAr6qW1LBeb';

    // 4. BigQueryにユーザー情報を保存
    const account = await instagram.getInstagramAccount();
    const userId = await upsertUser({
      instagram_user_id: account.id,
      instagram_username: account.username,
      access_token: longTermToken,
      token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60日後
      drive_folder_id: driveFolder
    });

    // 5. 完全なデータセットを取得（GAS構造準拠）
    const { reels, stories, insights } = await instagram.getCompleteDataset(userId);

    // 6. データをBigQueryに保存
    await Promise.all([
      insertInstagramReels(reels),
      insertInstagramStories(stories),
      insertInstagramInsights([insights])
    ]);

    return NextResponse.json({
      success: true,
      userId,
      accountInfo: {
        username: account.username,
        followerCount: account.followers_count.toLocaleString(),
        mediaCount: account.media_count.toLocaleString(),
        totalReels: reels.length,
        totalStories: stories.length,
        totalReelsViews: reels.reduce((sum, reel) => sum + (reel.views || 0), 0),
        totalStoriesViews: stories.reduce((sum, story) => sum + (story.views || 0), 0),
      },
      message: `ダッシュボードが作成されました！\\n\\nユーザー: ${account.username}\\nフォロワー数: ${account.followers_count.toLocaleString()}\\nリール: ${reels.length}件\\nストーリーズ: ${stories.length}件`
    });

  } catch (error) {
    console.error('Error creating dashboard:', error);
    return NextResponse.json({
      success: false,
      error: 'ダッシュボード作成に失敗しました',
      details: error instanceof Error ? error.message : '不明なエラー'
    }, { status: 500 });
  }
}