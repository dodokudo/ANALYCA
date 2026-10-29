import { isThreadsAuthError } from './threads-auth-error';

export type ThreadsConnectionStatus = 'connected' | 'reauth_required' | 'unknown';

/** Check the saved credential rather than treating a past post failure as current. */
export async function getThreadsConnectionStatus(token?: string | null): Promise<ThreadsConnectionStatus> {
  if (!token) return 'reauth_required';

  try {
    const response = await fetch('https://graph.threads.net/v1.0/me?fields=id', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    const body = await response.json();
    if (response.ok && body.id) return 'connected';
    return isThreadsAuthError(body) ? 'reauth_required' : 'unknown';
  } catch {
    // Network and service failures do not prove that login is required.
    return 'unknown';
  }
}
