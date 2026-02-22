import { NextRequest, NextResponse } from 'next/server';
import { ThreadsAPI } from '@/lib/threads';
import {
  upsertThreadsUser,
  insertThreadsPosts,
  findUserIdByThreadsId,
  upsertThreadsDailyMetrics,
} from '@/lib/bigquery';
import { uploadImageToGCS } from '@/lib/gcs';
import { v4 as uuidv4 } from 'uuid';

export const maxDuration = 60;

const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || 'https://analyca.jp'}/api/auth/threads/callback`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code')?.replace(/#_$/, ''); // Threads adds #_ suffix
  const error = searchParams.get('error');
  const errorReason = searchParams.get('error_reason');

  // OAuth denied or error
  if (error) {
    console.error('Threads OAuth error:', error, errorReason);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorReason || error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=no_code', request.url)
    );
  }

  try {
    // Step 1: Exchange authorization code for short-lived token
    const { access_token: shortToken, user_id: threadsUserId } =
      await ThreadsAPI.exchangeCodeForShortToken(code, REDIRECT_URI);

    // Step 2: Exchange short-lived token for long-lived token (60 days)
    const longToken = await ThreadsAPI.exchangeForLongTermToken(shortToken);
    const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    // Step 3: Get account info
    const threads = new ThreadsAPI(longToken);
    const account = await threads.getAccountInfo();

    // Step 4: Check for existing user (by Threads ID)
    const existingUserId = await findUserIdByThreadsId(account.id || threadsUserId);

    // Step 5: Upload profile picture to GCS
    let profilePictureUrl = account.threads_profile_picture_url || null;
    if (profilePictureUrl) {
      try {
        const fileName = `threads_profile_${account.id || threadsUserId}_${Date.now()}`;
        const gcsUrl = await uploadImageToGCS(profilePictureUrl, fileName, 'profile-pictures/threads');
        if (gcsUrl) {
          profilePictureUrl = gcsUrl;
        }
      } catch (e) {
        console.warn('Profile picture GCS upload failed (using CDN URL):', e);
      }
    }

    // Step 6: Save user (with profile picture)
    const userId = await upsertThreadsUser({
      user_id: existingUserId || undefined,
      threads_user_id: account.id || threadsUserId,
      threads_username: account.username,
      threads_access_token: longToken,
      threads_token_expires_at: tokenExpiresAt,
      threads_profile_picture_url: profilePictureUrl || undefined,
    });

    // Step 7: Fetch initial insights (follower count)
    try {
      const GRAPH_BASE = 'https://graph.threads.net/v1.0';
      const insightsRes = await fetch(
        `${GRAPH_BASE}/${account.id || threadsUserId}/threads_insights?metric=followers_count&access_token=${longToken}`
      );
      if (insightsRes.ok) {
        const insightsData = await insightsRes.json();
        let followersCount = 0;
        if (insightsData.data && Array.isArray(insightsData.data)) {
          for (const metric of insightsData.data) {
            if (metric.name === 'followers_count') {
              followersCount = metric.total_value?.value || 0;
            }
          }
        }
        const today = new Date().toISOString().split('T')[0];
        await upsertThreadsDailyMetrics({
          id: uuidv4(),
          user_id: userId,
          date: today,
          followers_count: followersCount,
          follower_delta: 0,
          total_views: 0,
          total_likes: 0,
          total_replies: 0,
          post_count: 0,
        });
      }
    } catch (insightsError) {
      console.warn('Initial insights sync failed (continuing):', insightsError);
    }

    // Step 8: Fetch initial posts (5 posts, timeout prevention)
    try {
      const postsWithInsights = await threads.getPostsWithInsights(5);
      const postsToInsert = postsWithInsights.map(post => ({
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

      if (postsToInsert.length > 0) {
        await insertThreadsPosts(postsToInsert);
      }
    } catch (syncError) {
      console.warn('Initial post sync failed (continuing):', syncError);
    }

    // Step 9: Redirect to dashboard with userId for localStorage persistence
    return NextResponse.redirect(
      new URL(`/${userId}?tab=threads&auth=threads_complete`, request.url)
    );
  } catch (err) {
    console.error('Threads OAuth callback error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
