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
    const igUrl = `${INSTAGRAM_GRAPH_BASE}${testPath}?access_token=${accessToken}`;
    const igResponse = await fetch(igUrl);
    if (igResponse.ok) {
      return INSTAGRAM_GRAPH_BASE;
    }
  } catch {
    // ignore
  }

  return FACEBOOK_GRAPH_BASE;
}

export { INSTAGRAM_GRAPH_BASE, FACEBOOK_GRAPH_BASE };
