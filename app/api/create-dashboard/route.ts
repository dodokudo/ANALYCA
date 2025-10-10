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
    const { accessToken, type = 'instagram' } = await request.json();

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'アクセストークンが提供されていません'
      }, { status: 400 });
    }

    if (type === 'instagram') {
      // Instagram用の処理
      const instagramLongTermToken = await InstagramAPI.exchangeForLongTermToken(accessToken);
      const instagram = new InstagramAPI(instagramLongTermToken);
      const driveFolder = process.env.GOOGLE_DRIVE_FOLDER_ID || '1lH92NxycLKE4adG3hlURhIAr6qW1LBeb';

      const account = await instagram.getInstagramAccount();
      const userId = await upsertUser({
        instagram_user_id: account.id,
        instagram_username: account.username,
        access_token: instagramLongTermToken,
        token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        drive_folder_id: driveFolder
      });

      const { reels, stories, insights } = await instagram.getCompleteDataset(userId);

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
        message: `Instagramダッシュボードが作成されました！\n\nユーザー: ${account.username}\nフォロワー数: ${account.followers_count.toLocaleString()}\nリール: ${reels.length}件\nストーリーズ: ${stories.length}件`
      });

    } else if (type === 'threads') {
      // Threads用の処理
      const threadsLongTermToken = await ThreadsAPI.exchangeForLongTermToken(accessToken);
      const threads = new ThreadsAPI(threadsLongTermToken);

      const account = await threads.getAccountInfo();
      const userId = uuidv4();

      // Threadsデータを取得
      const postsWithInsights = await threads.getPostsWithInsights(100);
      const threadsPostsWithInsights = postsWithInsights.map(post => ({
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

      await insertThreadsPosts(threadsPostsWithInsights);

      return NextResponse.json({
        success: true,
        userId,
        accountInfo: {
          username: account.username,
          threadsUsername: account.username,
          totalThreadsPosts: threadsPostsWithInsights.length,
          totalThreadsViews: threadsPostsWithInsights.reduce((sum, post) => sum + post.views, 0),
        },
        message: `Threadsダッシュボードが作成されました！\n\nユーザー: ${account.username}\n投稿: ${threadsPostsWithInsights.length}件`
      });
    }

    return NextResponse.json({
      success: false,
      error: '不正なタイプが指定されました'
    }, { status: 400 });

  } catch (error) {
    console.error('Error creating dashboard:', error);
    return NextResponse.json({
      success: false,
      error: 'ダッシュボード作成に失敗しました',
      details: error instanceof Error ? error.message : '不明なエラー'
    }, { status: 500 });
  }
}