import { NextRequest, NextResponse } from 'next/server';
import {
  getUserById,
  upsertUser,
  findUserIdByInstagramId,
  updateLastLogin,
} from '@/lib/bigquery';
import { isChannelBlockedByPlan, resolveEffectivePlanId } from '@/lib/univapay/plans';

export const maxDuration = 300;

const INSTAGRAM_APP_ID = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID || '1238454094361851';
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET || '';
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || 'https://analyca.jp'}/api/auth/instagram/callback`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorReason = searchParams.get('error_reason');
  const stateParam = searchParams.get('state');

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

    // Step 4: Check for existing user (by Instagram ID or pending user from checkout)
    let pendingUserId: string | undefined;
    if (stateParam) {
      try {
        const state = JSON.parse(decodeURIComponent(stateParam));
        pendingUserId = state.pendingUserId;
      } catch { /* invalid state, ignore */ }
    }
    const existingUserId = pendingUserId || await findUserIdByInstagramId(igUserId);
    if (!existingUserId) {
      return NextResponse.redirect(new URL('/pricing?error=plan_required', request.url));
    }
    if (existingUserId) {
      const existingUser = await getUserById(existingUserId);
      if (!existingUser) {
        return NextResponse.redirect(new URL('/pricing?error=plan_required', request.url));
      }
      const effectivePlanId = resolveEffectivePlanId(existingUser.plan_id, {
        has_threads: existingUser.has_threads,
        has_instagram: existingUser.has_instagram,
      });
      if (isChannelBlockedByPlan(effectivePlanId, 'instagram')) {
        return NextResponse.redirect(new URL(`/${existingUserId}?tab=instagram`, request.url));
      }
    }

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

    // Step 6: 最終ログイン日時を更新
    await updateLastLogin(userId).catch(err => console.error('Failed to update last_login_at:', err));

    // Step 7: 即座にダッシュボードへリダイレクト（syncing=trueでフルsync自動実行）
    // Cookieで userId を渡す（ダッシュボード側でlocalStorageに保存）
    const redirectUrl = new URL(`/auth/callback-success?userId=${userId}&tab=instagram&syncing=true`, request.url);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set('analycaUserId', userId, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1年
      sameSite: 'lax',
    });
    return response;
  } catch (err) {
    console.error('Instagram OAuth callback error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
