import { NextRequest, NextResponse } from 'next/server';
import { getUserDashboardData } from '@/lib/bigquery';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    // ユーザーの全データを取得
    const { reels, stories, insights, lineData, threadsPosts } = await getUserDashboardData(userId);

    // データを統合ダッシュボード形式に変換
    const dashboardData = {
      reels: {
        total: reels.length,
        totalViews: reels.reduce((sum, reel) => sum + (reel.views || 0), 0),
        totalLikes: reels.reduce((sum, reel) => sum + (reel.like_count || 0), 0),
        totalComments: reels.reduce((sum, reel) => sum + (reel.comments_count || 0), 0),
        totalReach: reels.reduce((sum, reel) => sum + (reel.reach || 0), 0),
        data: reels.map(reel => ({
          id: reel.instagram_id,
          caption: reel.caption,
          media_type: reel.media_type,
          permalink: reel.permalink,
          timestamp: reel.timestamp,
          views: reel.views,
          reach: reel.reach,
          like_count: reel.like_count,
          comments_count: reel.comments_count,
          saved: reel.saved,
          shares: reel.shares,
          total_interactions: reel.total_interactions,
          avg_watch_time_seconds: reel.avg_watch_time_seconds,
          thumbnail_url: reel.thumbnail_url,
        }))
      },
      stories: {
        total: stories.length,
        totalViews: stories.reduce((sum, story) => sum + (story.views || 0), 0),
        totalReach: stories.reduce((sum, story) => sum + (story.reach || 0), 0),
        totalReplies: stories.reduce((sum, story) => sum + (story.replies || 0), 0),
        data: stories.map(story => ({
          id: story.instagram_id,
          timestamp: story.timestamp,
          views: story.views,
          reach: story.reach,
          replies: story.replies,
          total_interactions: story.total_interactions,
          follows: story.follows,
          profile_visits: story.profile_visits,
          navigation: story.navigation,
          thumbnail_url: story.thumbnail_url,
        }))
      },
      insights: {
        latest: insights[0] || null,
        data: insights
      },
      lineData: {
        latest: lineData[0] || null,
        data: lineData
      },
      threads: {
        total: threadsPosts.length,
        totalViews: threadsPosts.reduce((sum, post) => sum + (post.views || 0), 0),
        totalLikes: threadsPosts.reduce((sum, post) => sum + (post.likes || 0), 0),
        totalReplies: threadsPosts.reduce((sum, post) => sum + (post.replies || 0), 0),
        data: threadsPosts.map(post => ({
          id: post.id,
          threads_id: post.threads_id,
          text: post.text,
          timestamp: post.timestamp,
          permalink: post.permalink,
          media_type: post.media_type,
          is_quote_post: post.is_quote_post,
          views: post.views,
          likes: post.likes,
          replies: post.replies,
          reposts: post.reposts,
          quotes: post.quotes,
        }))
      },
      summary: {
        totalReelsViews: reels.reduce((sum, reel) => sum + (reel.views || 0), 0),
        totalStoriesViews: stories.reduce((sum, story) => sum + (story.views || 0), 0),
        currentFollowers: insights[0]?.followers_count || 0,
        lineFollowers: lineData[0]?.followers || 0,
        totalThreadsViews: threadsPosts.reduce((sum, post) => sum + (post.views || 0), 0),
      }
    };

    return NextResponse.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({
      success: false,
      error: 'ダッシュボードデータの取得に失敗しました',
      details: error instanceof Error ? error.message : '不明なエラー'
    }, { status: 500 });
  }
}