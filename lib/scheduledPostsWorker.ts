import { ThreadsAPI } from '@/lib/threads';
import { getUserById } from '@/lib/bigquery';
import {
  listAllPendingPosts,
  updateScheduledPost,
  getScheduledPostById,
  claimScheduledPost,
  type ScheduledPostRow,
} from '@/lib/bigqueryScheduledPosts';

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 5000;
const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // 10分

function getJstNow() {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  return new Date(now.getTime() + jstOffset);
}

function isScheduledTimePassed(scheduledTimeIso: string): boolean {
  const scheduledTime = new Date(scheduledTimeIso);
  const now = new Date();
  return scheduledTime.getTime() <= now.getTime();
}

async function postWithRetry(
  api: ThreadsAPI,
  text: string,
  replyToId?: string,
): Promise<string> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await api.createPost(text, replyToId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn(
        `[scheduledPostsWorker] createPost attempt ${attempt}/${MAX_RETRIES} failed: ${message}`,
      );
      if (attempt === MAX_RETRIES) throw error;
      const delay = attempt * RETRY_BASE_DELAY_MS;
      console.log(`[scheduledPostsWorker] Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Unreachable');
}

async function fetchOnePendingPost(): Promise<ScheduledPostRow | undefined> {
  const jstNow = getJstNow();
  const jstYesterday = new Date(jstNow.getTime() - 24 * 60 * 60 * 1000);
  const startDate = jstYesterday.toISOString().split('T')[0];
  const endDate = jstNow.toISOString().split('T')[0];

  const items = await listAllPendingPosts({ startDate, endDate });

  return items.find((item) => {
    return item.status === 'scheduled' && isScheduledTimePassed(item.scheduled_time);
  });
}

async function recoverStuckPosts(): Promise<number> {
  const jstNow = getJstNow();
  const jstYesterday = new Date(jstNow.getTime() - 24 * 60 * 60 * 1000);
  const startDate = jstYesterday.toISOString().split('T')[0];
  const endDate = jstNow.toISOString().split('T')[0];

  const items = await listAllPendingPosts({ startDate, endDate });
  const threshold = new Date(Date.now() - STUCK_THRESHOLD_MS);
  let recovered = 0;

  for (const item of items) {
    if (item.status !== 'processing') continue;
    const updatedAt = new Date(item.updated_at);
    if (updatedAt.getTime() >= threshold.getTime()) continue;

    console.log(
      `[scheduledPostsWorker] Recovering stuck post: ${item.schedule_id} (stuck since ${item.updated_at})`,
    );
    await updateScheduledPost(item.schedule_id, { status: 'scheduled' });
    recovered++;
  }

  return recovered;
}

async function executeScheduledPost(post: ScheduledPostRow): Promise<{
  success: boolean;
  mainThreadId?: string;
  comment1ThreadId?: string;
  comment2ThreadId?: string;
  error?: string;
}> {
  console.log(`[scheduledPostsWorker] Executing: ${post.schedule_id} for user ${post.user_id}`);

  // ユーザーのThreadsトークンを取得
  const user = await getUserById(post.user_id);
  if (!user?.threads_access_token) {
    const errMsg = `No Threads token for user ${post.user_id}`;
    console.error(`[scheduledPostsWorker] ${errMsg}`);
    await updateScheduledPost(post.schedule_id, { status: 'failed' });
    return { success: false, error: errMsg };
  }

  const api = new ThreadsAPI(user.threads_access_token);

  try {
    // 1. メイン投稿
    let mainThreadId = post.main_thread_id || undefined;
    if (!mainThreadId) {
      console.log('[scheduledPostsWorker] Posting main thread...');
      mainThreadId = await postWithRetry(api, post.main_text);
      console.log(`[scheduledPostsWorker] Main thread posted: ${mainThreadId}`);
      await updateScheduledPost(post.schedule_id, { mainThreadId });
    } else {
      console.log(`[scheduledPostsWorker] Main thread already posted: ${mainThreadId}`);
    }

    let replyToId = mainThreadId;

    // 2. コメント1
    let comment1ThreadId = post.comment1_thread_id || undefined;
    if (!comment1ThreadId && post.comment1?.trim()) {
      const delay1 = Math.floor(Math.random() * 60000) + 30000;
      console.log(`[scheduledPostsWorker] Waiting ${(delay1 / 1000).toFixed(1)}s before comment1...`);
      await new Promise((resolve) => setTimeout(resolve, delay1));

      console.log('[scheduledPostsWorker] Posting comment1...');
      comment1ThreadId = await postWithRetry(api, post.comment1, replyToId);
      console.log(`[scheduledPostsWorker] Comment1 posted: ${comment1ThreadId}`);
      await updateScheduledPost(post.schedule_id, { comment1ThreadId });
      replyToId = comment1ThreadId;
    } else if (comment1ThreadId) {
      replyToId = comment1ThreadId;
    }

    // 3. コメント2
    let comment2ThreadId = post.comment2_thread_id || undefined;
    if (!comment2ThreadId && post.comment2?.trim()) {
      const delay2 = Math.floor(Math.random() * 60000) + 30000;
      console.log(`[scheduledPostsWorker] Waiting ${(delay2 / 1000).toFixed(1)}s before comment2...`);
      await new Promise((resolve) => setTimeout(resolve, delay2));

      console.log('[scheduledPostsWorker] Posting comment2...');
      comment2ThreadId = await postWithRetry(api, post.comment2, replyToId);
      console.log(`[scheduledPostsWorker] Comment2 posted: ${comment2ThreadId}`);
      await updateScheduledPost(post.schedule_id, { comment2ThreadId });
    }

    await updateScheduledPost(post.schedule_id, { status: 'posted' });
    console.log(`[scheduledPostsWorker] Successfully completed: ${post.schedule_id}`);
    return { success: true, mainThreadId, comment1ThreadId, comment2ThreadId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[scheduledPostsWorker] Failed: ${post.schedule_id}`, errorMessage);
    await updateScheduledPost(post.schedule_id, { status: 'failed' });
    return { success: false, error: errorMessage };
  }
}

export async function processScheduledPosts(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  recovered: number;
  results: Array<{
    scheduleId: string;
    success: boolean;
    mainThreadId?: string;
    error?: string;
  }>;
}> {
  console.log('[scheduledPostsWorker] Starting...');
  console.log('[scheduledPostsWorker] Current time (UTC):', new Date().toISOString());
  console.log('[scheduledPostsWorker] Current time (JST):', getJstNow().toISOString());

  const recovered = await recoverStuckPosts();
  if (recovered > 0) {
    console.log(`[scheduledPostsWorker] Recovered ${recovered} stuck posts`);
  }

  const post = await fetchOnePendingPost();
  if (!post) {
    console.log('[scheduledPostsWorker] No pending posts found');
    return { processed: 0, succeeded: 0, failed: 0, recovered, results: [] };
  }

  const claimed = await claimScheduledPost(post.schedule_id);
  if (!claimed) {
    console.log(`[scheduledPostsWorker] Post already claimed: ${post.schedule_id}`);
    return { processed: 0, succeeded: 0, failed: 0, recovered, results: [] };
  }

  const freshPost = await getScheduledPostById(post.schedule_id);
  if (!freshPost) {
    console.log(`[scheduledPostsWorker] Post not found after claim: ${post.schedule_id}`);
    return { processed: 0, succeeded: 0, failed: 0, recovered, results: [] };
  }

  const result = await executeScheduledPost(freshPost);

  return {
    processed: 1,
    succeeded: result.success ? 1 : 0,
    failed: result.success ? 0 : 1,
    recovered,
    results: [
      {
        scheduleId: post.schedule_id,
        success: result.success,
        mainThreadId: result.mainThreadId,
        error: result.error,
      },
    ],
  };
}
