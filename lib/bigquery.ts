import { BigQuery } from '@google-cloud/bigquery';
import { v4 as uuidv4 } from 'uuid';

// BigQuery設定
// 環境変数名のフォールバック対応（ローカル: GOOGLE_CLOUD_PROJECT_ID、Vercel: PROJECT_ID）
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.PROJECT_ID;
const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS || '{}';

// JSONパースを安全に行う
function parseCredentials(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json);
  } catch (e) {
    console.error('Failed to parse credentials JSON:', e);
    return {};
  }
}

const bigquery = new BigQuery({
  projectId,
  credentials: parseCredentials(credentialsJson),
});

const dataset = bigquery.dataset('analyca');

export interface User {
  user_id: string;
  instagram_user_id?: string | null;
  instagram_username?: string | null;
  access_token?: string | null;
  token_expires_at?: Date | null;
  drive_folder_id?: string | null;
  threads_user_id?: string | null;
  threads_username?: string | null;
  threads_access_token?: string | null;
  threads_token_expires_at?: Date | null;
  threads_profile_picture_url?: string | null;
  has_instagram?: boolean | null;
  has_threads?: boolean | null;
}

export interface InstagramReel {
  id: string;
  user_id: string;
  instagram_id: string;
  caption: string;
  media_product_type: string;
  media_type: string;
  permalink: string;
  timestamp: Date;
  views: number;
  reach: number;
  total_interactions: number;
  like_count: number;
  comments_count: number;
  saved: number;
  shares: number;
  video_view_total_time_hours: string;
  avg_watch_time_seconds: number;
  drive_image_url?: string;
  thumbnail_url?: string;
}

export interface InstagramStory {
  id: string;
  user_id: string;
  instagram_id: string;
  drive_image_url?: string;
  thumbnail_url?: string;
  timestamp: Date;
  views: number;
  reach: number;
  replies: number;
  caption?: string;
  total_interactions: number;
  follows: number;
  profile_visits: number;
  navigation: number;
}

export interface InstagramInsights {
  id: string;
  user_id: string;
  date: string;
  followers_count: number;
  posts_count: number;
  reach: number;
  engagement: number;
  profile_views: number;
  website_clicks: number;
}

export interface LineDaily {
  id: string;
  user_id: string;
  date: string;
  account_name: string;
  followers: number;
  targeted_reaches: number;
  blocks: number;
  broadcast: number;
  targeting: number;
  auto_response: number;
  welcome_response: number;
  chat: number;
  api_broadcast: number;
  api_push: number;
  api_multicast: number;
  api_narrowcast: number;
  api_reply: number;
}

export interface ThreadsPost {
  id: string;
  user_id: string;
  threads_id: string;
  text: string;
  timestamp: Date;
  permalink: string;
  media_type: string;
  is_quote_post: boolean;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
}

export interface ThreadsComment {
  id: string;
  user_id: string;
  comment_id: string;
  parent_post_id: string;
  text: string;
  timestamp: Date;
  permalink: string;
  has_replies: boolean;
  views: number;
  depth: number; // コメント欄の順番（0=コメント欄1, 1=コメント欄2, ...）
}

export interface ThreadsDailyMetrics {
  id: string;
  user_id: string;
  date: string;
  followers_count: number;
  follower_delta: number;
  total_views: number;
  total_likes: number;
  total_replies: number;
  post_count: number;
}

// ユーザー作成・更新
export async function upsertUser(userData: Omit<User, 'user_id'> & { user_id?: string }): Promise<string> {
  const userId = userData.user_id || uuidv4();

  const query = `
    MERGE \`mark-454114.analyca.users\` T
    USING (
      SELECT
        @user_id as user_id,
        @instagram_user_id as instagram_user_id,
        @instagram_username as instagram_username,
        @access_token as access_token,
        @token_expires_at as token_expires_at,
        @drive_folder_id as drive_folder_id,
        TRUE as has_instagram,
        CURRENT_TIMESTAMP() as updated_at
    ) S
    ON T.user_id = S.user_id
    WHEN MATCHED THEN
      UPDATE SET
        instagram_user_id = IFNULL(S.instagram_user_id, T.instagram_user_id),
        instagram_username = IFNULL(S.instagram_username, T.instagram_username),
        access_token = IFNULL(S.access_token, T.access_token),
        token_expires_at = IFNULL(S.token_expires_at, T.token_expires_at),
        drive_folder_id = IFNULL(S.drive_folder_id, T.drive_folder_id),
        has_instagram = TRUE,
        updated_at = S.updated_at
    WHEN NOT MATCHED THEN
      INSERT (
        user_id,
        instagram_user_id,
        instagram_username,
        access_token,
        token_expires_at,
        drive_folder_id,
        has_instagram,
        created_at,
        updated_at
      )
      VALUES (
        S.user_id,
        S.instagram_user_id,
        S.instagram_username,
        S.access_token,
        S.token_expires_at,
        S.drive_folder_id,
        TRUE,
        CURRENT_TIMESTAMP(),
        S.updated_at
      )
  `;

  const options = {
    query,
    params: {
      user_id: userId,
      instagram_user_id: userData.instagram_user_id,
      instagram_username: userData.instagram_username,
      access_token: userData.access_token,
      token_expires_at: userData.token_expires_at ? userData.token_expires_at.toISOString() : null,
      drive_folder_id: userData.drive_folder_id || null,
    },
  };

  await bigquery.query(options);
  return userId;
}

export async function upsertThreadsUser(userData: {
  threads_user_id: string;
  threads_username: string;
  threads_access_token: string;
  threads_token_expires_at: Date;
  threads_profile_picture_url?: string;
  user_id?: string;
}): Promise<string> {
  // user_idをThreadsのアカウントIDと同じにする（Instagram/Threadsで共通）
  const userId = userData.user_id || userData.threads_user_id;

  const query = `
    MERGE \`mark-454114.analyca.users\` T
    USING (
      SELECT
        @user_id as user_id,
        @threads_user_id as threads_user_id,
        @threads_username as threads_username,
        @threads_access_token as threads_access_token,
        TIMESTAMP(@threads_token_expires_at) as threads_token_expires_at,
        @threads_profile_picture_url as threads_profile_picture_url,
        TRUE as has_threads,
        CURRENT_TIMESTAMP() as updated_at
    ) S
    ON T.user_id = S.user_id
    WHEN MATCHED THEN
      UPDATE SET
        threads_user_id = COALESCE(S.threads_user_id, T.threads_user_id),
        threads_username = COALESCE(S.threads_username, T.threads_username),
        threads_access_token = COALESCE(S.threads_access_token, T.threads_access_token),
        threads_token_expires_at = COALESCE(S.threads_token_expires_at, T.threads_token_expires_at),
        threads_profile_picture_url = COALESCE(S.threads_profile_picture_url, T.threads_profile_picture_url),
        has_threads = TRUE,
        updated_at = S.updated_at
    WHEN NOT MATCHED THEN
      INSERT (
        user_id,
        threads_user_id,
        threads_username,
        threads_access_token,
        threads_token_expires_at,
        threads_profile_picture_url,
        has_threads,
        created_at,
        updated_at
      )
      VALUES (
        S.user_id,
        S.threads_user_id,
        S.threads_username,
        S.threads_access_token,
        S.threads_token_expires_at,
        S.threads_profile_picture_url,
        TRUE,
        CURRENT_TIMESTAMP(),
        S.updated_at
      )
  `;

  const options = {
    query,
    params: {
      user_id: userId,
      threads_user_id: userData.threads_user_id,
      threads_username: userData.threads_username,
      threads_access_token: userData.threads_access_token,
      threads_token_expires_at: userData.threads_token_expires_at.toISOString(),
      threads_profile_picture_url: userData.threads_profile_picture_url || null,
    },
  };

  await bigquery.query(options);
  return userId;
}

export async function findUserIdByInstagramId(instagramUserId: string): Promise<string | null> {
  const query = `
    SELECT user_id
    FROM \`mark-454114.analyca.users\`
    WHERE instagram_user_id = @instagram_user_id
    LIMIT 1
  `;

  const options = {
    query,
    params: { instagram_user_id: instagramUserId },
  };

  const [rows] = await bigquery.query(options);
  return rows.length > 0 ? (rows[0].user_id as string) : null;
}

export async function findUserIdByThreadsId(threadsUserId: string): Promise<string | null> {
  const query = `
    SELECT user_id
    FROM \`mark-454114.analyca.users\`
    WHERE threads_user_id = @threads_user_id
    LIMIT 1
  `;

  const options = {
    query,
    params: { threads_user_id: threadsUserId },
  };

  const [rows] = await bigquery.query(options);
  return rows.length > 0 ? (rows[0].user_id as string) : null;
}

// Instagram Reels データ保存
export async function insertInstagramReels(reels: InstagramReel[]): Promise<void> {
  if (reels.length === 0) return;

  const table = dataset.table('instagram_reels');
  await table.insert(reels.map(reel => ({
    ...reel,
    timestamp: reel.timestamp.toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })));
}

// Instagram Stories データ保存
export async function insertInstagramStories(stories: InstagramStory[]): Promise<void> {
  if (stories.length === 0) return;

  const table = dataset.table('instagram_stories');
  await table.insert(stories.map(story => ({
    ...story,
    timestamp: story.timestamp.toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })));
}

// Instagram インサイト保存
export async function insertInstagramInsights(insights: InstagramInsights[]): Promise<void> {
  if (insights.length === 0) return;

  const table = dataset.table('instagram_insights');
  await table.insert(insights.map(insight => ({
    ...insight,
    created_at: new Date().toISOString(),
  })));
}

// LINE日次データ保存
export async function insertLineDaily(lineData: LineDaily[]): Promise<void> {
  if (lineData.length === 0) return;

  const table = dataset.table('line_daily');
  await table.insert(lineData.map(data => ({
    ...data,
    created_at: new Date().toISOString(),
  })));
}

// ユーザーのトークン取得
export async function getUserToken(userId: string): Promise<string | null> {
  const query = `
    SELECT access_token, token_expires_at
    FROM \`mark-454114.analyca.users\`
    WHERE user_id = @user_id
    AND token_expires_at > CURRENT_TIMESTAMP()
  `;

  const options = {
    query,
    params: { user_id: userId },
  };

  const [rows] = await bigquery.query(options);
  return rows.length > 0 ? rows[0].access_token : null;
}

export async function getUserById(userId: string): Promise<User | null> {
  const query = `
    SELECT *
    FROM \`mark-454114.analyca.users\`
    WHERE user_id = @user_id
    LIMIT 1
  `;

  const options = {
    query,
    params: { user_id: userId },
  };

  const [rows] = await bigquery.query(options);
  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    user_id: row.user_id,
    instagram_user_id: row.instagram_user_id ?? null,
    instagram_username: row.instagram_username ?? null,
    access_token: row.access_token ?? null,
    token_expires_at: row.token_expires_at ? new Date(row.token_expires_at) : null,
    drive_folder_id: row.drive_folder_id ?? null,
    threads_user_id: row.threads_user_id ?? null,
    threads_username: row.threads_username ?? null,
    threads_access_token: row.threads_access_token ?? null,
    threads_token_expires_at: row.threads_token_expires_at ? new Date(row.threads_token_expires_at) : null,
    threads_profile_picture_url: row.threads_profile_picture_url ?? null,
    has_instagram: row.has_instagram ?? false,
    has_threads: row.has_threads ?? false,
  };
}

// ユーザーのリールデータ取得
export async function getUserReels(userId: string, limit: number = 50): Promise<InstagramReel[]> {
  const query = `
    SELECT *
    FROM \`mark-454114.analyca.instagram_reels\`
    WHERE user_id = @user_id
    ORDER BY timestamp DESC
    LIMIT @limit
  `;

  const options = {
    query,
    params: { user_id: userId, limit },
  };

  const [rows] = await bigquery.query(options);
  return rows.map(row => ({
    ...row,
    timestamp: new Date(row.timestamp),
  }));
}

// ユーザーのストーリーデータ取得
export async function getUserStories(userId: string, limit: number = 50): Promise<InstagramStory[]> {
  const query = `
    SELECT *
    FROM \`mark-454114.analyca.instagram_stories\`
    WHERE user_id = @user_id
    ORDER BY timestamp DESC
    LIMIT @limit
  `;

  const options = {
    query,
    params: { user_id: userId, limit },
  };

  const [rows] = await bigquery.query(options);
  return rows.map(row => ({
    ...row,
    timestamp: new Date(row.timestamp),
  }));
}

// ユーザーのインサイトデータ取得
export async function getUserInsights(userId: string, limit: number = 30): Promise<InstagramInsights[]> {
  const query = `
    SELECT *
    FROM \`mark-454114.analyca.instagram_insights\`
    WHERE user_id = @user_id
    ORDER BY date DESC
    LIMIT @limit
  `;

  const options = {
    query,
    params: { user_id: userId, limit },
  };

  const [rows] = await bigquery.query(options);
  return rows;
}

// ユーザーのLINEデータ取得
export async function getUserLineData(userId: string, limit: number = 30): Promise<LineDaily[]> {
  const query = `
    SELECT *
    FROM \`mark-454114.analyca.line_daily\`
    WHERE user_id = @user_id
    ORDER BY date DESC
    LIMIT @limit
  `;

  const options = {
    query,
    params: { user_id: userId, limit },
  };

  const [rows] = await bigquery.query(options);
  return rows;
}

// Threads投稿データ保存（ストリーミングINSERT - 重複はスキップ）
export async function insertThreadsPosts(posts: ThreadsPost[]): Promise<void> {
  if (posts.length === 0) return;

  // 既存のthreads_idを取得して重複を除外
  const userId = posts[0].user_id;
  const existingQuery = `
    SELECT threads_id
    FROM \`mark-454114.analyca.threads_posts\`
    WHERE user_id = @user_id
  `;
  const [existingRows] = await bigquery.query({
    query: existingQuery,
    params: { user_id: userId },
  });
  const existingIds = new Set(existingRows.map((r: { threads_id: string }) => r.threads_id));

  // 新規投稿のみフィルタ
  const newPosts = posts.filter(post => !existingIds.has(post.threads_id));

  if (newPosts.length === 0) {
    console.log('新規投稿なし（全て既存）');
    return;
  }

  const table = dataset.table('threads_posts');
  await table.insert(newPosts.map(post => ({
    ...post,
    timestamp: post.timestamp.toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })));

  console.log(`${newPosts.length}件の新規投稿を保存`);
}

// BigQueryのTimestamp型を安全にDateに変換するヘルパー
function parseBigQueryTimestamp(value: unknown): Date {
  if (!value) return new Date();

  // BigQueryTimestamp型（{value: string}）の場合
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return new Date((value as { value: string }).value);
  }

  // すでにDateの場合
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? new Date() : value;
  }

  // 文字列の場合
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? new Date() : date;
  }

  return new Date();
}

// ユーザーのThreads投稿データ取得
export async function getUserThreadsPosts(userId: string, limit: number = 50): Promise<ThreadsPost[]> {
  const query = `
    SELECT *
    FROM \`mark-454114.analyca.threads_posts\`
    WHERE user_id = @user_id
    ORDER BY timestamp DESC
    LIMIT @limit
  `;

  const options = {
    query,
    params: { user_id: userId, limit },
  };

  const [rows] = await bigquery.query(options);
  return rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    user_id: row.user_id as string,
    threads_id: row.threads_id as string,
    text: row.text as string,
    timestamp: parseBigQueryTimestamp(row.timestamp),
    permalink: row.permalink as string,
    media_type: row.media_type as string,
    is_quote_post: row.is_quote_post as boolean,
    views: (row.views as number) ?? 0,
    likes: (row.likes as number) ?? 0,
    replies: (row.replies as number) ?? 0,
    reposts: (row.reposts as number) ?? 0,
    quotes: (row.quotes as number) ?? 0,
  }));
}

// Threadsコメントデータ保存（重複はスキップ）
export async function insertThreadsComments(comments: ThreadsComment[]): Promise<void> {
  if (comments.length === 0) return;

  // 既存のcomment_idを取得して重複を除外
  const userId = comments[0].user_id;
  const existingQuery = `
    SELECT comment_id
    FROM \`mark-454114.analyca.threads_comments\`
    WHERE user_id = @user_id
  `;

  let existingIds = new Set<string>();
  try {
    const [existingRows] = await bigquery.query({
      query: existingQuery,
      params: { user_id: userId },
    });
    existingIds = new Set(existingRows.map((r: { comment_id: string }) => r.comment_id));
  } catch {
    // テーブルがない場合は空セット
  }

  // 新規コメントのみフィルタ
  const newComments = comments.filter(c => !existingIds.has(c.comment_id));

  if (newComments.length === 0) {
    console.log('新規コメントなし（全て既存）');
    return;
  }

  const table = dataset.table('threads_comments');
  await table.insert(newComments.map(comment => ({
    ...comment,
    timestamp: comment.timestamp.toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })));

  console.log(`${newComments.length}件の新規コメントを保存`);
}

// ユーザーのThreadsコメントデータ取得
export async function getUserThreadsComments(userId: string, limit: number = 100): Promise<ThreadsComment[]> {
  const query = `
    SELECT *
    FROM \`mark-454114.analyca.threads_comments\`
    WHERE user_id = @user_id
    ORDER BY parent_post_id, COALESCE(depth, 0), timestamp
    LIMIT @limit
  `;

  const options = {
    query,
    params: { user_id: userId, limit },
  };

  try {
    const [rows] = await bigquery.query(options);
    return rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      user_id: row.user_id as string,
      comment_id: row.comment_id as string,
      parent_post_id: row.parent_post_id as string,
      text: row.text as string,
      timestamp: parseBigQueryTimestamp(row.timestamp),
      permalink: row.permalink as string,
      has_replies: row.has_replies as boolean,
      views: (row.views as number) ?? 0,
      depth: (row.depth as number) ?? 0,
    }));
  } catch {
    // テーブルがなければ空配列を返す
    return [];
  }
}

// Threads日別メトリクス保存（MERGE）
export async function upsertThreadsDailyMetrics(metrics: ThreadsDailyMetrics): Promise<void> {
  const query = `
    MERGE \`mark-454114.analyca.threads_daily_metrics\` T
    USING (
      SELECT
        @id as id,
        @user_id as user_id,
        @date as date,
        @followers_count as followers_count,
        @follower_delta as follower_delta,
        @total_views as total_views,
        @total_likes as total_likes,
        @total_replies as total_replies,
        @post_count as post_count,
        CURRENT_TIMESTAMP() as updated_at
    ) S
    ON T.user_id = S.user_id AND T.date = S.date
    WHEN MATCHED THEN
      UPDATE SET
        followers_count = S.followers_count,
        follower_delta = S.follower_delta,
        total_views = S.total_views,
        total_likes = S.total_likes,
        total_replies = S.total_replies,
        post_count = S.post_count,
        updated_at = S.updated_at
    WHEN NOT MATCHED THEN
      INSERT (id, user_id, date, followers_count, follower_delta, total_views, total_likes, total_replies, post_count, created_at, updated_at)
      VALUES (S.id, S.user_id, S.date, S.followers_count, S.follower_delta, S.total_views, S.total_likes, S.total_replies, S.post_count, CURRENT_TIMESTAMP(), S.updated_at)
  `;

  const options = {
    query,
    params: {
      id: metrics.id,
      user_id: metrics.user_id,
      date: metrics.date,
      followers_count: metrics.followers_count,
      follower_delta: metrics.follower_delta,
      total_views: metrics.total_views,
      total_likes: metrics.total_likes,
      total_replies: metrics.total_replies,
      post_count: metrics.post_count,
    },
  };

  await bigquery.query(options);
}

// ユーザーのThreads日別メトリクス取得
export async function getUserThreadsDailyMetrics(userId: string, limit: number = 30): Promise<ThreadsDailyMetrics[]> {
  const query = `
    SELECT *
    FROM \`mark-454114.analyca.threads_daily_metrics\`
    WHERE user_id = @user_id
    ORDER BY date DESC
    LIMIT @limit
  `;

  const options = {
    query,
    params: { user_id: userId, limit },
  };

  try {
    const [rows] = await bigquery.query(options);
    return rows as ThreadsDailyMetrics[];
  } catch {
    // テーブルがなければ空配列を返す
    return [];
  }
}

// 統合ダッシュボードデータ取得
export async function getUserDashboardData(userId: string): Promise<{
  reels: InstagramReel[];
  stories: InstagramStory[];
  insights: InstagramInsights[];
  lineData: LineDaily[];
  threadsPosts: ThreadsPost[];
  threadsComments: ThreadsComment[];
  threadsDailyMetrics: ThreadsDailyMetrics[];
}> {
  const [reels, stories, insights, lineData, threadsPosts, threadsComments, threadsDailyMetrics] = await Promise.all([
    getUserReels(userId, 50),
    getUserStories(userId, 50),
    getUserInsights(userId, 30),
    getUserLineData(userId, 30),
    getUserThreadsPosts(userId, 100),
    getUserThreadsComments(userId, 100),
    getUserThreadsDailyMetrics(userId, 30)
  ]);

  return { reels, stories, insights, lineData, threadsPosts, threadsComments, threadsDailyMetrics };
}
