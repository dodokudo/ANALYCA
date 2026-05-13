/**
 * Instagram Graph API helper
 * Instagram Login tokens use graph.instagram.com
 * Facebook Login tokens use graph.facebook.com
 * This helper tries Instagram first, falls back to Facebook
 */

const INSTAGRAM_GRAPH_BASE = 'https://graph.instagram.com/v23.0';
const FACEBOOK_GRAPH_BASE = 'https://graph.facebook.com/v23.0';

/**
 * Fetch from Instagram Graph API with automatic fallback
 * Tries graph.instagram.com first, falls back to graph.facebook.com
 */
export async function fetchInstagramAPI(
  path: string,
  accessToken: string,
): Promise<Response> {
  // Try Instagram Graph API first
  const igUrl = `${INSTAGRAM_GRAPH_BASE}${path}${path.includes('?') ? '&' : '?'}access_token=${accessToken}`;
  const igResponse = await fetch(igUrl);

  if (igResponse.ok) {
    return igResponse;
  }

  // Check if it's an auth error (token type mismatch)
  const igStatus = igResponse.status;
  if (igStatus === 400 || igStatus === 190) {
    // Try Facebook Graph API as fallback
    const fbUrl = `${FACEBOOK_GRAPH_BASE}${path}${path.includes('?') ? '&' : '?'}access_token=${accessToken}`;
    const fbResponse = await fetch(fbUrl);
    return fbResponse;
  }

  // Return the original error response for non-auth errors
  return igResponse;
}

/**
 * Get the working Graph API base URL for a given access token
 * Tests the token and returns the appropriate base URL
 */
export async function detectGraphBase(accessToken: string, testPath: string = '/me'): Promise<string> {
  try {
    const separator = testPath.includes('?') ? '&' : '?';
    const igUrl = `${INSTAGRAM_GRAPH_BASE}${testPath}${separator}access_token=${accessToken}`;
    const igResponse = await fetch(igUrl);
    if (igResponse.ok) {
      return INSTAGRAM_GRAPH_BASE;
    }
  } catch {
    // ignore
  }

  return FACEBOOK_GRAPH_BASE;
}

/**
 * Refresh an Instagram Login long-lived access token.
 * Instagramの長期トークンは graph.instagram.com/refresh_access_token で延長する。
 * 仕様: 期限内かつ過去24h以内に使われたトークンのみ更新可。期限切れトークンは更新不可で再ログイン必須。
 */
export async function refreshInstagramLoginToken(accessToken: string): Promise<{ access_token: string; expires_in: number }> {
  const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${accessToken}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Instagram token refresh failed (${response.status}): ${errorText}`);
  }
  return response.json();
}

export { INSTAGRAM_GRAPH_BASE, FACEBOOK_GRAPH_BASE };
