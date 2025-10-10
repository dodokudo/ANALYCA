import { NextRequest, NextResponse } from 'next/server';
import { InstagramAPI } from '@/lib/instagram';
import { ThreadsAPI } from '@/lib/threads';
import {
  upsertUser,
  insertInstagramReels,
  insertInstagramStories,
  insertInstagramInsights,
  insertThreadsPosts
} from '@/lib/bigquery';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json();

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'アクセストークンが提供されていません'
      }, { status: 400 });
    }

    // 1. 短期トークンを長期トークンに変換（Instagram）
    const instagramLongTermToken = await InstagramAPI.exchangeForLongTermToken(accessToken);

    // 2. Instagram APIクライアントを初期化
    const instagram = new InstagramAPI(instagramLongTermToken);

    // 3. Threadsトークンを長期トークンに変換
    let threadsLongTermToken: string | undefined;
    let threadsAccount: { id: string; username: string } | undefined;
    try {
      threadsLongTermToken = await ThreadsAPI.exchangeForLongTermToken(accessToken);
      const threads = new ThreadsAPI(threadsLongTermToken);
      threadsAccount = await threads.getAccountInfo();
    } catch (error) {
      console.warn('Threads token exchange failed. Continuing with Instagram only.', error);
    }

    // 4. ユーザー情報とドライブフォルダIDを設定から取得
    const driveFolder = process.env.GOOGLE_DRIVE_FOLDER_ID || '1lH92NxycLKE4adG3hlURhIAr6qW1LBeb';

    // 5. BigQueryにユーザー情報を保存
    const account = await instagram.getInstagramAccount();
    const userId = await upsertUser({
      instagram_user_id: account.id,
      instagram_username: account.username,
      access_token: instagramLongTermToken,
      token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60日後
      drive_folder_id: driveFolder
    });

    // 6. 完全なデータセットを取得（GAS構造準拠）
    const { reels, stories, insights } = await instagram.getCompleteDataset(userId);

    // 7. Threadsデータを取得
    let threadsPostsWithInsights: Array<{
      id: string;
      user_id: string;
      threads_id: string;
      text: string;
      timestamp: Date;
      permalink: string;
      media_type: string;
      is_quote_post: boolean;
      views: number;
      likes: number;
      replies: number;
      reposts: number;
      quotes: number;
    }> = [];

    if (threadsLongTermToken) {
      try {
        const threads = new ThreadsAPI(threadsLongTermToken);
        const postsWithInsights = await threads.getPostsWithInsights(100);

        threadsPostsWithInsights = postsWithInsights.map(post => ({
          id: uuidv4(),
          user_id: userId,
          threads_id: post.id,
          text: post.text,
          timestamp: new Date(post.timestamp),
          permalink: post.permalink,
          media_type: post.media_type,
          is_quote_post: post.is_quote_post || false,
          views: post.insights.views || 0,
          likes: post.insights.likes || 0,
          replies: post.insights.replies || 0,
          reposts: post.insights.reposts || 0,
          quotes: post.insights.quotes || 0,
        }));
      } catch (error) {
        console.warn('Failed to fetch Threads data:', error);
      }
    }

    // 8. データをBigQueryに保存
    await Promise.all([
      insertInstagramReels(reels),
      insertInstagramStories(stories),
      insertInstagramInsights([insights]),
      threadsPostsWithInsights.length > 0 ? insertThreadsPosts(threadsPostsWithInsights) : Promise.resolve()
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
        totalThreadsPosts: threadsPostsWithInsights.length,
        totalThreadsViews: threadsPostsWithInsights.reduce((sum, post) => sum + post.views, 0),
        threadsUsername: threadsAccount?.username,
      },
      message: `ダッシュボードが作成されました！\\n\\nInstagram: ${account.username}\\nフォロワー数: ${account.followers_count.toLocaleString()}\\nリール: ${reels.length}件\\nストーリーズ: ${stories.length}件${threadsAccount ? `\\n\\nThreads: ${threadsAccount.username}\\n投稿: ${threadsPostsWithInsights.length}件` : ''}`
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