/**
 * Runs one collection pass over the watchlist: profile snapshot, public posts,
 * and the self-reply chain under every post that has replies.
 *
 * Access-level reality (verified live against the API):
 *   - Before App Review approval, only @meta, @threads, @instagram and @facebook
 *     resolve. Everything else fails with "Application does not have permission
 *     for this action". That is surfaced per account rather than failing the run.
 *   - Per-post views/likes are never available for other people's posts, so nothing
 *     here pretends to measure reach. What it measures is construction: timing,
 *     length, tree shape, where the CTA sits.
 */

import { ThreadsDiscoveryAPI, ThreadsConversationAPI } from '@/lib/threadsDiscovery';
import {
  addToWatchlist,
  getAccountSummaries,
  listWatchlist,
  markCollected,
  normalizeUsername,
  replaceAccountData,
  saveProfileSnapshot,
  type NodeRow,
  type PostRow,
} from '@/lib/research';

/** Meta's own accounts - the only ones readable before Advanced Access is granted. */
export const STANDARD_ACCESS_USERNAMES = ['meta', 'threads', 'instagram', 'facebook'];

const PERMISSION_ERROR = 'Application does not have permission for this action';

export interface AccountResult {
  username: string;
  ok: boolean;
  postCount: number;
  selfReplyCount: number;
  error: string | null;
  needsApproval: boolean;
}

export interface CollectResult {
  results: AccountResult[];
  collectedAt: string;
}

function isPermissionError(message: string): boolean {
  return message.includes(PERMISSION_ERROR) || message.includes('does not have permission');
}

/**
 * Collect one account. `maxPosts` caps the profile_posts walk; conversations are
 * only fetched for posts that report has_replies, to stay inside the shared
 * 1,000 requests / 24h budget for the discovery endpoints.
 */
export async function collectAccount(
  userId: string,
  accessToken: string,
  username: string,
  maxPosts = 30
): Promise<AccountResult> {
  const clean = normalizeUsername(username);
  const discovery = new ThreadsDiscoveryAPI(accessToken);
  const conversations = new ThreadsConversationAPI(accessToken);

  try {
    const profile = await discovery.profileLookup(clean);
    await saveProfileSnapshot(userId, {
      username: clean,
      name: profile.name,
      biography: profile.biography,
      profilePictureUrl: profile.profile_picture_url,
      isVerified: profile.is_verified,
      followerCount: profile.follower_count,
      likesCount: profile.likes_count,
      repliesCount: profile.replies_count,
      repostsCount: profile.reposts_count,
      quotesCount: profile.quotes_count,
      viewsCount: profile.views_count,
    });

    const rawPosts = await discovery.getProfilePosts(clean, maxPosts);
    const posts: PostRow[] = [];
    const nodes: NodeRow[] = [];

    for (const post of rawPosts) {
      let selfReplies = 0;
      let otherReplies = 0;
      let maxDepth = 0;

      // Skip the conversation call when the API already says there are no replies.
      // On a 30-post account that typically halves the requests charged against the
      // shared 1,000/24h discovery budget.
      if (post.id && post.has_replies !== false) {
        try {
          const conversation = await conversations.getConversation(post.id);
          const rootTime = new Date(post.timestamp).getTime();

          for (const node of conversation) {
            const isSelf = node.username?.toLowerCase() === clean;
            if (isSelf) {
              selfReplies += 1;
              maxDepth = Math.max(maxDepth, node.depth);
            } else {
              otherReplies += 1;
            }

            const nodeTime = new Date(node.timestamp).getTime();
            nodes.push({
              rootPostId: post.id,
              nodeId: node.id,
              nodeUsername: node.username ?? '',
              text: node.text ?? '',
              postedAt: node.timestamp,
              permalink: node.permalink ?? '',
              parentId: node.replied_to?.id ?? null,
              depth: node.depth,
              isSelfReply: Boolean(isSelf),
              secondsAfterRoot:
                Number.isFinite(rootTime) && Number.isFinite(nodeTime)
                  ? Math.round((nodeTime - rootTime) / 1000)
                  : null,
            });
          }
        } catch (error) {
          // A single unreadable conversation must not lose the whole account.
          console.warn(`[research] conversation failed for ${post.id}:`, error);
        }
      }

      posts.push({
        postId: post.id,
        text: post.text ?? '',
        postedAt: post.timestamp,
        permalink: post.permalink ?? '',
        mediaType: post.media_type ?? '',
        isQuotePost: Boolean(post.is_quote_post),
        hasReplies: selfReplies + otherReplies > 0,
        selfReplyCount: selfReplies,
        maxDepth,
        otherReplyCount: otherReplies,
      });
    }

    await replaceAccountData(userId, clean, posts, nodes);
    await markCollected(userId, clean, null);

    return {
      username: clean,
      ok: true,
      postCount: posts.length,
      selfReplyCount: nodes.filter((n) => n.isSelfReply).length,
      error: null,
      needsApproval: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const needsApproval = isPermissionError(message);
    const readable = needsApproval
      ? 'App Review未承認のため、このアカウントはまだ取得できません'
      : message;

    await markCollected(userId, clean, readable).catch(() => {});

    return {
      username: clean,
      ok: false,
      postCount: 0,
      selfReplyCount: 0,
      error: readable,
      needsApproval,
    };
  }
}

/** Collect every active account on the watchlist, sequentially to respect rate limits. */
export async function collectAll(
  userId: string,
  accessToken: string,
  options: { username?: string; maxPosts?: number } = {}
): Promise<CollectResult> {
  const watchlist = await listWatchlist(userId);
  const targets = options.username
    ? watchlist.filter((w) => w.username === normalizeUsername(options.username!))
    : watchlist.filter((w) => w.isActive);

  const results: AccountResult[] = [];
  for (const entry of targets) {
    results.push(
      await collectAccount(userId, accessToken, entry.username, options.maxPosts ?? 30)
    );
  }

  return { results, collectedAt: new Date().toISOString() };
}

/**
 * Populate an empty watchlist with the accounts that are readable today, so the
 * dashboard has real data before App Review completes.
 */
export async function seedStandardAccessAccounts(userId: string): Promise<void> {
  const existing = await listWatchlist(userId);
  if (existing.length > 0) return;

  for (const username of STANDARD_ACCESS_USERNAMES) {
    await addToWatchlist(userId, username, 'Standard Accessで取得できる検証用アカウント');
  }
}

export { getAccountSummaries };
