import { NextRequest, NextResponse } from 'next/server';
import {
  upsertUser,
  findUserIdByInstagramId,
} from '@/lib/bigquery';

export const maxDuration = 60;

const INSTAGRAM_APP_ID = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID || '1238454094361851';
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET || '';
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || 'https://analyca.jp'}/api/auth/instagram/callback`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorReason = searchParams.get('error_reason');

  // OAuth denied or error
  if (error) {
    console.error('Instagram OAuth error:', error, errorReason);
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
    const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: INSTAGRAM_APP_ID,
        client_secret: INSTAGRAM_APP_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Instagram token exchange failed:', errorData);
      throw new Error(`Token exchange failed: ${errorData}`);
    }

    const tokenData = await tokenResponse.json();
    const shortToken = tokenData.access_token;
    const instagramUserId = String(tokenData.user_id);

    // Step 2: Exchange short-lived token for long-lived token (60 days)
    const longTokenResponse = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${INSTAGRAM_APP_SECRET}&access_token=${shortToken}`
    );

    if (!longTokenResponse.ok) {
      const errorData = await longTokenResponse.text();
      console.error('Instagram long-lived token exchange failed:', errorData);
      throw new Error(`Long-lived token exchange failed: ${errorData}`);
    }

    const longTokenData = await longTokenResponse.json();
    const longToken = longTokenData.access_token;
    const tokenExpiresAt = new Date(Date.now() + (longTokenData.expires_in || 5184000) * 1000);

    // Step 3: Get user profile
    const profileResponse = await fetch(
      `https://graph.instagram.com/me?fields=user_id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count&access_token=${longToken}`
    );

    if (!profileResponse.ok) {
      const errorData = await profileResponse.text();
      console.error('Instagram profile fetch failed:', errorData);
      throw new Error(`Profile fetch failed: ${errorData}`);
    }

    const profile = await profileResponse.json();
    const igUserId = String(profile.user_id || instagramUserId);

    // Step 4: Check for existing user (by Instagram ID)
    const existingUserId = await findUserIdByInstagramId(igUserId);

    // Step 5: Save user
    const userId = await upsertUser({
      user_id: existingUserId || undefined,
      instagram_user_id: igUserId,
      instagram_username: profile.username,
      instagram_profile_picture_url: profile.profile_picture_url || null,
      access_token: longToken,
      token_expires_at: tokenExpiresAt,
      drive_folder_id: process.env.GOOGLE_DRIVE_FOLDER_ID || '1lH92NxycLKE4adG3hlURhIAr6qW1LBeb',
    });

    // Step 6: 即座にダッシュボードへリダイレクト（syncing=trueでフルsync自動実行）
    return NextResponse.redirect(
      new URL(`/${userId}?tab=instagram&auth=instagram_complete&syncing=true`, request.url)
    );
  } catch (err) {
    console.error('Instagram OAuth callback error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
