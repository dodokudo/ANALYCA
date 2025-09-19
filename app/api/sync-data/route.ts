import { NextRequest, NextResponse } from 'next/server';
import { InstagramAPI } from '@/lib/instagram';
import {
  getUserToken,
  insertInstagramReels,
  insertInstagramStories,
  insertInstagramInsights
} from '@/lib/bigquery';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'ユーザーIDが必要です'
      }, { status: 400 });
    }

    // 1. ユーザーのトークンを取得
    const accessToken = await getUserToken(userId);

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'アクセストークンが見つかりません。再ログインが必要です。'
      }, { status: 401 });
    }

    // 2. Instagram APIクライアントを初期化
    const instagram = new InstagramAPI(accessToken);

    // 3. 最新データを取得（GAS構造準拠）
    const { reels, stories, insights } = await instagram.getCompleteDataset(userId);

    // 4. データをBigQueryに保存（重複チェック付き）
    await Promise.all([
      insertInstagramReels(reels),
      insertInstagramStories(stories),
      insertInstagramInsights([insights])
    ]);

    return NextResponse.json({
      success: true,
      message: 'データの同期が完了しました！',
      syncedData: {
        reelsCount: reels.length,
        storiesCount: stories.length,
        totalReelsViews: reels.reduce((sum, reel) => sum + (reel.views || 0), 0),
        totalStoriesViews: stories.reduce((sum, story) => sum + (story.views || 0), 0),
        followerCount: insights.followers_count,
      }
    });

  } catch (error) {
    console.error('Error syncing data:', error);
    return NextResponse.json({
      success: false,
      error: 'データ同期に失敗しました',
      details: error instanceof Error ? error.message : '不明なエラー'
    }, { status: 500 });
  }
}

// 自動実行用のエンドポイント（cron job用）
export async function GET() {
  try {
    // TODO: 将来的には全ユーザーの自動同期を実装
    // 現在は手動同期のみサポート
    console.log('Automatic sync endpoint called:', new Date().toISOString());

    return NextResponse.json({
      success: true,
      message: '自動同期は現在開発中です。手動同期をご利用ください。',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in automatic sync:', error);
    return NextResponse.json({
      success: false,
      error: '自動同期に失敗しました'
    }, { status: 500 });
  }
}