import { getBigQueryClient, projectId } from '@/app/threads-grandprix/grandprix-bigquery';

export type GrandprixConnectionStatus = 'connected' | 'not_connected' | 'reconnect_required' | 'needs_check';

export async function checkGrandprixConnection(username: string): Promise<{ status: GrandprixConnectionStatus; userId: string | null }> {
  const [rows] = await getBigQueryClient().query({
    query: `SELECT user_id, threads_user_id, threads_username, has_threads,
      threads_access_token, threads_token_expires_at
      FROM \`${projectId}.analyca.users\`
      WHERE LOWER(REGEXP_REPLACE(TRIM(threads_username), r'^@', '')) = @username
      ORDER BY threads_token_expires_at DESC, created_at ASC LIMIT 2`,
    params: { username },
  });
  if (!rows.length) return { status: 'not_connected', userId: null };
  if (rows.length > 1) return { status: 'needs_check', userId: null };
  const user = rows[0];
  const userId = String(user.user_id);
  if (!user.has_threads || !user.threads_user_id) return { status: 'not_connected', userId };
  const expiresAt = new Date(user.threads_token_expires_at?.value || user.threads_token_expires_at || 0);
  if (!user.threads_access_token || !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return { status: 'reconnect_required', userId };
  }
  try {
    // 保存期限だけでなく、現在の本人アカウントとインサイト読取権限を確認する。
    const account = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${encodeURIComponent(user.threads_access_token)}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    const profile = await account.json();
    if (!account.ok) return { status: profile.error?.code === 190 || account.status === 401 ? 'reconnect_required' : 'needs_check', userId };
    if (String(profile.id) !== String(user.threads_user_id) || String(profile.username).toLowerCase() !== username) return { status: 'needs_check', userId };
    const insights = await fetch(`https://graph.threads.net/v1.0/${encodeURIComponent(user.threads_user_id)}/threads_insights?metric=followers_count&access_token=${encodeURIComponent(user.threads_access_token)}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    const metrics = await insights.json();
    if (!insights.ok) return { status: [10, 190, 200].includes(metrics.error?.code) || insights.status === 401 ? 'reconnect_required' : 'needs_check', userId };
    return { status: Array.isArray(metrics.data) && metrics.data.some((metric: { name?: string; total_value?: { value?: unknown } }) => metric.name === 'followers_count' && typeof metric.total_value?.value === 'number') ? 'connected' : 'needs_check', userId };
  } catch {
    return { status: 'needs_check', userId };
  }
}
