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
const STUCK_THRESHOLD_MS = 4 * 60 * 1000; // 4分（cron3分間隔+余裕1分）
const COMMENT_DELAY_MIN_MS = 15000; // コメント間待機の最小値: 15秒
const COMMENT_DELAY_RANGE_MS = 30000; // 上乗せ範囲: 最大+30秒（合計15-45秒）
const TIMEOUT_SAFE_MARGIN_MS = 240000; // 関数起動から240秒経過で安全撤退（maxDuration 300秒）

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
    return (item.status === 'scheduled' || item.status === 'partial') && isScheduledTimePassed(item.scheduled_time);
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
  commentThreadIds: Record<number, string | undefined>;
  error?: string;
}> {
  console.log(`[scheduledPostsWorker] Executing: ${post.schedule_id} for user ${post.user_id}`);

  const startedAt = Date.now();
  const errors: string[] = [];
  const commentThreadIds: Record<number, string | undefined> = {};

  // ユーザーのThreadsトークンを取得
  const user = await getUserById(post.user_id);
  if (!user?.threads_access_token) {
    const errMsg = `No Threads token for user ${post.user_id}`;
    console.error(`[scheduledPostsWorker] ${errMsg}`);
    await updateScheduledPost(post.schedule_id, { status: 'failed', errorMessage: errMsg });
    return { success: false, commentThreadIds, error: errMsg };
  }

  const api = new ThreadsAPI(user.threads_access_token);

  // 1. メイン投稿（既に投稿済みならスキップ）
  let mainThreadId = post.main_thread_id || undefined;
  if (!mainThreadId) {
    try {
      console.log('[scheduledPostsWorker] Posting main thread...');
      mainThreadId = await postWithRetry(api, post.main_text);
      console.log(`[scheduledPostsWorker] Main thread posted: ${mainThreadId}`);
      await updateScheduledPost(post.schedule_id, { mainThreadId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[scheduledPostsWorker] Main thread failed: ${post.schedule_id}`, errorMessage);
      await updateScheduledPost(post.schedule_id, { status: 'failed', errorMessage: `Main: ${errorMessage}` });
      return { success: false, commentThreadIds, error: errorMessage };
    }
  } else {
    console.log(`[scheduledPostsWorker] Main thread already posted: ${mainThreadId}`);
  }

  let replyToId = mainThreadId;

  // 2. コメント1〜7を順次投稿
  const comments: Array<{
    index: number;
    text: string;
    existingThreadId?: string | null;
    updateKey:
      | 'comment1ThreadId'
      | 'comment2ThreadId'
      | 'comment3ThreadId'
      | 'comment4ThreadId'
      | 'comment5ThreadId'
      | 'comment6ThreadId'
      | 'comment7ThreadId';
  }> = [
    { index: 1, text: post.comment1, existingThreadId: post.comment1_thread_id, updateKey: 'comment1ThreadId' },
    { index: 2, text: post.comment2, existingThreadId: post.comment2_thread_id, updateKey: 'comment2ThreadId' },
    { index: 3, text: post.comment3, existingThreadId: post.comment3_thread_id, updateKey: 'comment3ThreadId' },
    { index: 4, text: post.comment4, existingThreadId: post.comment4_thread_id, updateKey: 'comment4ThreadId' },
    { index: 5, text: post.comment5, existingThreadId: post.comment5_thread_id, updateKey: 'comment5ThreadId' },
    { index: 6, text: post.comment6, existingThreadId: post.comment6_thread_id, updateKey: 'comment6ThreadId' },
    { index: 7, text: post.comment7, existingThreadId: post.comment7_thread_id, updateKey: 'comment7ThreadId' },
  ];

  let timedOut = false;
  for (const comment of comments) {
    const existing = comment.existingThreadId || undefined;
    if (existing) {
      console.log(`[scheduledPostsWorker] Comment${comment.index} already posted: ${existing}`);
      commentThreadIds[comment.index] = existing;
      replyToId = existing;
      continue;
    }
    if (!comment.text?.trim()) {
      continue;
    }

    // タイムアウト前の安全撤退: 残時間が足りなければ次cronに委ねる
    const elapsed = Date.now() - startedAt;
    if (elapsed >= TIMEOUT_SAFE_MARGIN_MS) {
      console.warn(
        `[scheduledPostsWorker] Timeout margin reached (${(elapsed / 1000).toFixed(1)}s), yielding to next cron for comment${comment.index}+`,
      );
      timedOut = true;
      break;
    }

    try {
      const delay = Math.floor(Math.random() * COMMENT_DELAY_RANGE_MS) + COMMENT_DELAY_MIN_MS;
      console.log(
        `[scheduledPostsWorker] Waiting ${(delay / 1000).toFixed(1)}s before comment${comment.index}...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));

      console.log(`[scheduledPostsWorker] Posting comment${comment.index}...`);
      const threadId = await postWithRetry(api, comment.text, replyToId);
      console.log(`[scheduledPostsWorker] Comment${comment.index} posted: ${threadId}`);
      await updateScheduledPost(post.schedule_id, { [comment.updateKey]: threadId });
      commentThreadIds[comment.index] = threadId;
      replyToId = threadId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[scheduledPostsWorker] Comment${comment.index} failed: ${post.schedule_id}`, errorMessage);
      errors.push(`Comment${comment.index}: ${errorMessage}`);
    }
  }

  // 結果判定
  if (timedOut) {
    const combinedError = errors.length > 0 ? `${errors.join('; ')}; timeout-yield` : 'timeout-yield';
    await updateScheduledPost(post.schedule_id, { status: 'partial', errorMessage: combinedError });
    console.log(`[scheduledPostsWorker] Timeout yield: ${post.schedule_id} (${combinedError})`);
    return { success: true, mainThreadId, commentThreadIds, error: combinedError };
  }
  if (errors.length > 0) {
    const combinedError = errors.join('; ');
    await updateScheduledPost(post.schedule_id, { status: 'partial', errorMessage: combinedError });
    console.log(`[scheduledPostsWorker] Partial completion: ${post.schedule_id} (${combinedError})`);
    return { success: true, mainThreadId, commentThreadIds, error: combinedError };
  }
  await updateScheduledPost(post.schedule_id, { status: 'posted' });
  console.log(`[scheduledPostsWorker] Successfully completed: ${post.schedule_id}`);
  return { success: true, mainThreadId, commentThreadIds };
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
