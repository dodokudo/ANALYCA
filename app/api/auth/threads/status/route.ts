import { NextRequest, NextResponse } from 'next/server';
import { getUserById } from '@/lib/bigquery';
import { listScheduledPosts } from '@/lib/bigqueryScheduledPosts';
import { getThreadsConnectionStatus } from '@/lib/threads-connection-status';
import { isThreadsAuthError } from '@/lib/threads-auth-error';

export async function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400, headers });
  try {
    const user = await getUserById(userId);
    if (!user) return NextResponse.json({ status: 'unknown' }, { status: 404, headers });
    if (!user.has_threads) return NextResponse.json({ status: 'not_connected' }, { headers });
    const status = await getThreadsConnectionStatus(user.threads_access_token);
    let failedCount: number | null = null;
    let failedScheduleId: string | null = null;
    if (status === 'connected' && request.nextUrl.searchParams.get('includeFailures') === '1') {
      try {
        const posts = await listScheduledPosts(userId, {});
        const failed = posts.filter(post => (post.status === 'failed' || post.status === 'partial') && isThreadsAuthError(post.error_message));
        failedCount = failed.length;
        failedScheduleId = failed[0]?.schedule_id ?? null;
      } catch { /* A failure to load history must not undo a confirmed reconnection. */ }
    }
    return NextResponse.json({ status, failedCount, failedScheduleId }, { headers });
  } catch {
    return NextResponse.json({ status: 'unknown' }, { status: 503, headers });
  }
}
