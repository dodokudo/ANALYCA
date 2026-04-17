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
let ensureUserAccessLogsTablePromise: Promise<void> | null = null;

/**
 * DML（INSERT/UPDATE/DELETE/MERGE）を確実に実行するヘルパー
 * bigquery.query() はDMLで成功レスポンスを返しつつ未反映になることがあるため、
 * createQueryJob() + getQueryResults() を使用する
 */
async function executeDML(options: { query: string; params?: Record<string, unknown>; types?: Record<string, string> }): Promise<void> {
  const [job] = await bigquery.createQueryJob(options);
  await job.getQueryResults();
}

async function ensureUserAccessLogsTable(): Promise<void> {
  if (!ensureUserAccessLogsTablePromise) {
    ensureUserAccessLogsTablePromise = executeDML({
      query: `
        CREATE TABLE IF NOT EXISTS \`${projectId}.analyca.user_access_logs\` (
          id STRING NOT NULL,
          user_id STRING NOT NULL,
          access_path STRING,
          user_agent STRING,
          accessed_at TIMESTAMP NOT NULL
        )
      `,
    }).catch((error) => {
      ensureUserAccessLogsTablePromise = null;
      throw error;
    });
  }

  return ensureUserAccessLogsTablePromise;
}

export interface User {
  user_id: string;
  email?: string | null;
  instagram_user_id?: string | null;
  instagram_username?: string | null;
  instagram_profile_picture_url?: string | null;
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
  subscription_id?: string | null;
  plan_id?: string | null;
  subscription_status?: string | null;
  subscription_created_at?: Date | null;
  subscription_expires_at?: Date | null;
  recurring_token_id?: string | null;
  trial_ends_at?: Date | null;
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

export interface ThreadsDailyPostStats {
  date: string;
  post_count: number;
  total_views: number;
  total_likes: number;
  total_replies: number;
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
        @instagram_profile_picture_url as instagram_profile_picture_url,
        @access_token as access_token,
        SAFE.PARSE_TIMESTAMP('%Y-%m-%dT%H:%M:%E*SZ', @token_expires_at) as token_expires_at,
        @drive_folder_id as drive_folder_id,
        TRUE as has_instagram,
        CURRENT_TIMESTAMP() as updated_at
    ) S
    ON T.user_id = S.user_id
    WHEN MATCHED THEN
      UPDATE SET
        instagram_user_id = IFNULL(S.instagram_user_id, T.instagram_user_id),
        instagram_username = IFNULL(S.instagram_username, T.instagram_username),
        instagram_profile_picture_url = IFNULL(S.instagram_profile_picture_url, T.instagram_profile_picture_url),
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
        instagram_profile_picture_url,
        access_token,
        token_expires_at,
        drive_folder_id,
        has_instagram,
        subscription_status,
        created_at,
        updated_at
      )
      VALUES (
        S.user_id,
        S.instagram_user_id,
        S.instagram_username,
        S.instagram_profile_picture_url,
        S.access_token,
        S.token_expires_at,
        S.drive_folder_id,
        TRUE,
        'none',
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
      instagram_profile_picture_url: userData.instagram_profile_picture_url || null,
      access_token: userData.access_token,
      token_expires_at: userData.token_expires_at ? userData.token_expires_at.toISOString() : null,
      drive_folder_id: userData.drive_folder_id || null,
    },
    types: {
      instagram_profile_picture_url: 'STRING',
      token_expires_at: 'STRING',
      drive_folder_id: 'STRING',
    },
  };

  await executeDML(options);
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
        SAFE.PARSE_TIMESTAMP('%Y-%m-%dT%H:%M:%E*SZ', @threads_token_expires_at) as threads_token_expires_at,
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
        subscription_status,
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
        'none',
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
    types: {
      threads_profile_picture_url: 'STRING',
    },
  };

  await executeDML(options);
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
    // undefinedをnullに変換（BigQueryストリーミングインサート対策）
    drive_image_url: reel.drive_image_url ?? null,
    thumbnail_url: reel.thumbnail_url ?? null,
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
    // undefinedをnullに変換（BigQueryストリーミングインサート対策）
    drive_image_url: story.drive_image_url ?? null,
    thumbnail_url: story.thumbnail_url ?? null,
    caption: story.caption ?? null,
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
    email: row.email ?? null,
    instagram_user_id: row.instagram_user_id ?? null,
    instagram_username: row.instagram_username ?? null,
    instagram_profile_picture_url: row.instagram_profile_picture_url ?? null,
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
    subscription_id: row.subscription_id ?? null,
    plan_id: row.plan_id ?? null,
    subscription_status: row.subscription_status ?? null,
    subscription_created_at: row.subscription_created_at ? new Date(row.subscription_created_at) : null,
    subscription_expires_at: row.subscription_expires_at ? new Date(row.subscription_expires_at) : null,
    recurring_token_id: row.recurring_token_id ?? null,
    trial_ends_at: row.trial_ends_at ? new Date(row.trial_ends_at) : null,
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
    timestamp: parseBigQueryTimestamp(row.timestamp),
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
    timestamp: parseBigQueryTimestamp(row.timestamp),
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

// Threads投稿データ保存（MERGE文を使用 - ストリーミングバッファ制限を回避）
// ストリーミングバッファエラー発生時はINSERT IGNOREスタイルで新規のみ挿入
export async function insertThreadsPosts(posts: ThreadsPost[]): Promise<{ newCount: number; updatedCount: number }> {
  if (posts.length === 0) return { newCount: 0, updatedCount: 0 };

  // バッチMERGE: 50件ずつ1回のMERGEクエリで処理（1件ずつ実行の100倍高速）
  const BATCH_SIZE = 50;
  let totalProcessed = 0;

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);

    // UNION ALLでソースデータを構築
    const sourceRows = batch.map((_, idx) => `
      SELECT
        @id_${idx} as id,
        @user_id_${idx} as user_id,
        @threads_id_${idx} as threads_id,
        @text_${idx} as text,
        TIMESTAMP(@timestamp_${idx}) as timestamp,
        @permalink_${idx} as permalink,
        @media_type_${idx} as media_type,
        @is_quote_post_${idx} as is_quote_post,
        @views_${idx} as views,
        @likes_${idx} as likes,
        @replies_${idx} as replies,
        @reposts_${idx} as reposts,
        @quotes_${idx} as quotes,
        CURRENT_TIMESTAMP() as updated_at
    `).join(' UNION ALL ');

    const mergeQuery = `
      MERGE \`mark-454114.analyca.threads_posts\` T
      USING (${sourceRows}) S
      ON T.user_id = S.user_id AND T.threads_id = S.threads_id
      WHEN MATCHED THEN
        UPDATE SET
          views = S.views,
          likes = S.likes,
          replies = S.replies,
          reposts = S.reposts,
          quotes = S.quotes,
          updated_at = S.updated_at
      WHEN NOT MATCHED THEN
        INSERT (id, user_id, threads_id, text, timestamp, permalink, media_type, is_quote_post, views, likes, replies, reposts, quotes, created_at, updated_at)
        VALUES (S.id, S.user_id, S.threads_id, S.text, S.timestamp, S.permalink, S.media_type, S.is_quote_post, S.views, S.likes, S.replies, S.reposts, S.quotes, CURRENT_TIMESTAMP(), S.updated_at)
    `;

    // パラメータを構築
    const params: Record<string, string | number | boolean> = {};
    batch.forEach((post, idx) => {
      params[`id_${idx}`] = post.id;
      params[`user_id_${idx}`] = post.user_id;
      params[`threads_id_${idx}`] = post.threads_id;
      params[`text_${idx}`] = post.text;
      params[`timestamp_${idx}`] = post.timestamp.toISOString();
      params[`permalink_${idx}`] = post.permalink;
      params[`media_type_${idx}`] = post.media_type;
      params[`is_quote_post_${idx}`] = post.is_quote_post;
      params[`views_${idx}`] = post.views;
      params[`likes_${idx}`] = post.likes;
      params[`replies_${idx}`] = post.replies;
      params[`reposts_${idx}`] = post.reposts;
      params[`quotes_${idx}`] = post.quotes;
    });

    try {
      await executeDML({ query: mergeQuery, params });
      totalProcessed += batch.length;
    } catch (error) {
      console.error(`Batch MERGE failed for ${batch.length} posts:`, error);
      // バッチが失敗した場合、1件ずつフォールバック
      for (const post of batch) {
        try {
          await executeDML({
            query: `
              MERGE \`mark-454114.analyca.threads_posts\` T
              USING (SELECT @user_id as user_id, @threads_id as threads_id, @id as id, @text as text, TIMESTAMP(@timestamp) as timestamp, @permalink as permalink, @media_type as media_type, @is_quote_post as is_quote_post, @views as views, @likes as likes, @replies as replies, @reposts as reposts, @quotes as quotes, CURRENT_TIMESTAMP() as updated_at) S
              ON T.user_id = S.user_id AND T.threads_id = S.threads_id
              WHEN MATCHED THEN UPDATE SET views = S.views, likes = S.likes, replies = S.replies, reposts = S.reposts, quotes = S.quotes, updated_at = S.updated_at
              WHEN NOT MATCHED THEN INSERT (id, user_id, threads_id, text, timestamp, permalink, media_type, is_quote_post, views, likes, replies, reposts, quotes, created_at, updated_at) VALUES (S.id, S.user_id, S.threads_id, S.text, S.timestamp, S.permalink, S.media_type, S.is_quote_post, S.views, S.likes, S.replies, S.reposts, S.quotes, CURRENT_TIMESTAMP(), S.updated_at)
            `,
            params: {
              id: post.id, user_id: post.user_id, threads_id: post.threads_id, text: post.text,
              timestamp: post.timestamp.toISOString(), permalink: post.permalink, media_type: post.media_type,
              is_quote_post: post.is_quote_post, views: post.views, likes: post.likes, replies: post.replies,
              reposts: post.reposts, quotes: post.quotes,
            },
          });
          totalProcessed++;
        } catch (singleError) {
          console.error(`Single MERGE failed for threads_id ${post.threads_id}:`, singleError);
        }
      }
    }
  }

  console.log(`${totalProcessed}件のThreads投稿を処理（バッチMERGE使用）`);
  return { newCount: totalProcessed, updatedCount: 0 };
}

// BigQueryのTimestamp型を安全にDateに変換するヘルパー
function parseBigQueryTimestamp(value: unknown): Date {
  if (!value) return new Date();

  try {
    // BigQueryTimestamp型（{value: string}）の場合
    if (typeof value === 'object' && value !== null && 'value' in value) {
      const innerValue = (value as { value: unknown }).value;
      if (!innerValue) return new Date();
      const date = new Date(String(innerValue));
      return isNaN(date.getTime()) ? new Date() : date;
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

    // 数値の場合（タイムスタンプ）
    if (typeof value === 'number') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? new Date() : date;
    }

    return new Date();
  } catch {
    return new Date();
  }
}

function normalizeBigQueryDate(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const inner = (value as { value: unknown }).value;
    if (inner instanceof Date) return inner.toISOString().slice(0, 10);
    if (typeof inner === 'string') return inner.slice(0, 10);
    return String(inner ?? '').slice(0, 10);
  }
  return String(value).slice(0, 10);
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

// Threadsコメントデータ保存（MERGE文を使用 - ストリーミングバッファ制限を回避）
// ストリーミングバッファエラー発生時はINSERT ONLY（新規レコードのみ）
export async function insertThreadsComments(comments: ThreadsComment[]): Promise<{ newCount: number; updatedCount: number }> {
  if (comments.length === 0) return { newCount: 0, updatedCount: 0 };

  // バッチMERGE: 50件ずつ1回のMERGEクエリで処理
  const BATCH_SIZE = 50;
  let totalProcessed = 0;

  for (let i = 0; i < comments.length; i += BATCH_SIZE) {
    const batch = comments.slice(i, i + BATCH_SIZE);

    const sourceRows = batch.map((_, idx) => `
      SELECT
        @id_${idx} as id,
        @user_id_${idx} as user_id,
        @comment_id_${idx} as comment_id,
        @parent_post_id_${idx} as parent_post_id,
        @text_${idx} as text,
        TIMESTAMP(@timestamp_${idx}) as timestamp,
        @permalink_${idx} as permalink,
        @has_replies_${idx} as has_replies,
        @views_${idx} as views,
        @depth_${idx} as depth,
        CURRENT_TIMESTAMP() as updated_at
    `).join(' UNION ALL ');

    const mergeQuery = `
      MERGE \`mark-454114.analyca.threads_comments\` T
      USING (${sourceRows}) S
      ON T.user_id = S.user_id AND T.comment_id = S.comment_id
      WHEN MATCHED THEN
        UPDATE SET views = S.views, updated_at = S.updated_at
      WHEN NOT MATCHED THEN
        INSERT (id, user_id, comment_id, parent_post_id, text, timestamp, permalink, has_replies, views, depth, created_at, updated_at)
        VALUES (S.id, S.user_id, S.comment_id, S.parent_post_id, S.text, S.timestamp, S.permalink, S.has_replies, S.views, S.depth, CURRENT_TIMESTAMP(), S.updated_at)
    `;

    const params: Record<string, string | number | boolean> = {};
    batch.forEach((comment, idx) => {
      params[`id_${idx}`] = comment.id;
      params[`user_id_${idx}`] = comment.user_id;
      params[`comment_id_${idx}`] = comment.comment_id;
      params[`parent_post_id_${idx}`] = comment.parent_post_id;
      params[`text_${idx}`] = comment.text;
      params[`timestamp_${idx}`] = comment.timestamp.toISOString();
      params[`permalink_${idx}`] = comment.permalink;
      params[`has_replies_${idx}`] = comment.has_replies;
      params[`views_${idx}`] = comment.views;
      params[`depth_${idx}`] = comment.depth;
    });

    try {
      await executeDML({ query: mergeQuery, params });
      totalProcessed += batch.length;
    } catch (error) {
      console.error(`Batch comment MERGE failed:`, error);
      // フォールバック: 1件ずつ処理
      for (const comment of batch) {
        try {
          await executeDML({
            query: `
              MERGE \`mark-454114.analyca.threads_comments\` T
              USING (SELECT @user_id as user_id, @comment_id as comment_id, @id as id, @parent_post_id as parent_post_id, @text as text, TIMESTAMP(@timestamp) as timestamp, @permalink as permalink, @has_replies as has_replies, @views as views, @depth as depth, CURRENT_TIMESTAMP() as updated_at) S
              ON T.user_id = S.user_id AND T.comment_id = S.comment_id
              WHEN MATCHED THEN UPDATE SET views = S.views, updated_at = S.updated_at
              WHEN NOT MATCHED THEN INSERT (id, user_id, comment_id, parent_post_id, text, timestamp, permalink, has_replies, views, depth, created_at, updated_at) VALUES (S.id, S.user_id, S.comment_id, S.parent_post_id, S.text, S.timestamp, S.permalink, S.has_replies, S.views, S.depth, CURRENT_TIMESTAMP(), S.updated_at)
            `,
            params: {
              id: comment.id, user_id: comment.user_id, comment_id: comment.comment_id,
              parent_post_id: comment.parent_post_id, text: comment.text,
              timestamp: comment.timestamp.toISOString(), permalink: comment.permalink,
              has_replies: comment.has_replies, views: comment.views, depth: comment.depth,
            },
          });
          totalProcessed++;
        } catch (singleError) {
          console.error(`Single comment MERGE failed for ${comment.comment_id}:`, singleError);
        }
      }
    }
  }

  console.log(`${totalProcessed}件のThreadsコメントを処理（バッチMERGE使用）`);
  return { newCount: totalProcessed, updatedCount: 0 };
}

// ユーザーのThreadsコメントデータ取得
export async function getUserThreadsComments(userId: string, limit: number = 100): Promise<ThreadsComment[]> {
  const query = `
    SELECT *
    FROM \`mark-454114.analyca.threads_comments\`
    WHERE user_id = @user_id
    ORDER BY timestamp DESC
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

// 指定した投稿IDのコメントを全件取得
export async function getThreadsCommentsForPosts(userId: string, postIds: string[]): Promise<ThreadsComment[]> {
  if (postIds.length === 0) return [];

  const query = `
    SELECT *
    FROM \`mark-454114.analyca.threads_comments\`
    WHERE user_id = @user_id
      AND parent_post_id IN UNNEST(@post_ids)
    ORDER BY parent_post_id, COALESCE(depth, 0), timestamp
  `;

  const options = {
    query,
    params: { user_id: userId, post_ids: postIds },
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

  await executeDML(options);
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

// ユーザーのThreads日別投稿統計を取得
export async function getUserThreadsDailyPostStats(userId: string, limit: number = 90): Promise<ThreadsDailyPostStats[]> {
  const query = `
    SELECT
      DATE(timestamp) as date,
      COUNT(*) as post_count,
      SUM(COALESCE(views, 0)) as total_views,
      SUM(COALESCE(likes, 0)) as total_likes,
      SUM(COALESCE(replies, 0)) as total_replies
    FROM \`mark-454114.analyca.threads_posts\`
    WHERE user_id = @user_id
    GROUP BY DATE(timestamp)
    ORDER BY date DESC
    LIMIT @limit
  `;

  const options = {
    query,
    params: { user_id: userId, limit },
  };

  try {
    const [rows] = await bigquery.query(options);
    return rows
      .map((row: Record<string, unknown>) => ({
        date: normalizeBigQueryDate(row.date),
        post_count: Number(row.post_count ?? 0) || 0,
        total_views: Number(row.total_views ?? 0) || 0,
        total_likes: Number(row.total_likes ?? 0) || 0,
        total_replies: Number(row.total_replies ?? 0) || 0,
      }))
      .filter((row) => row.date);
  } catch {
    return [];
  }
}

// アクティブなInstagramユーザー一覧を取得（トークン有効期限内）
export async function getActiveInstagramUsers(): Promise<User[]> {
  const query = `
    SELECT *
    FROM \`mark-454114.analyca.users\`
    WHERE has_instagram = TRUE
    AND access_token IS NOT NULL
    AND token_expires_at > CURRENT_TIMESTAMP()
  `;

  const [rows] = await bigquery.query({ query });
  return rows.map((row: Record<string, unknown>) => ({
    user_id: row.user_id as string,
    instagram_user_id: row.instagram_user_id as string | null,
    instagram_username: row.instagram_username as string | null,
    instagram_profile_picture_url: row.instagram_profile_picture_url as string | null,
    access_token: row.access_token as string | null,
    token_expires_at: row.token_expires_at ? new Date(row.token_expires_at as string) : null,
    drive_folder_id: row.drive_folder_id as string | null,
    threads_user_id: row.threads_user_id as string | null,
    threads_username: row.threads_username as string | null,
    threads_access_token: row.threads_access_token as string | null,
    threads_token_expires_at: row.threads_token_expires_at ? new Date(row.threads_token_expires_at as string) : null,
    threads_profile_picture_url: row.threads_profile_picture_url as string | null,
    has_instagram: row.has_instagram as boolean | null,
    has_threads: row.has_threads as boolean | null,
  }));
}

// アクティブなThreadsユーザー一覧を取得（トークン有効期限内）
export async function getActiveThreadsUsers(): Promise<User[]> {
  const query = `
    SELECT *
    FROM \`mark-454114.analyca.users\`
    WHERE has_threads = TRUE
    AND threads_access_token IS NOT NULL
    AND threads_token_expires_at > CURRENT_TIMESTAMP()
  `;

  const [rows] = await bigquery.query({ query });
  return rows.map((row: Record<string, unknown>) => ({
    user_id: row.user_id as string,
    instagram_user_id: row.instagram_user_id as string | null,
    instagram_username: row.instagram_username as string | null,
    instagram_profile_picture_url: row.instagram_profile_picture_url as string | null,
    access_token: row.access_token as string | null,
    token_expires_at: row.token_expires_at ? new Date(row.token_expires_at as string) : null,
    drive_folder_id: row.drive_folder_id as string | null,
    threads_user_id: row.threads_user_id as string | null,
    threads_username: row.threads_username as string | null,
    threads_access_token: row.threads_access_token as string | null,
    threads_token_expires_at: row.threads_token_expires_at ? new Date(row.threads_token_expires_at as string) : null,
    threads_profile_picture_url: row.threads_profile_picture_url as string | null,
    has_instagram: row.has_instagram as boolean | null,
    has_threads: row.has_threads as boolean | null,
  }));
}

// トークン更新が必要なThreadsユーザー一覧を取得（有効期限が7日以内）
export async function getThreadsUsersNeedingTokenRefresh(): Promise<User[]> {
  const query = `
    SELECT *
    FROM \`mark-454114.analyca.users\`
    WHERE has_threads = TRUE
    AND threads_access_token IS NOT NULL
    AND threads_token_expires_at > CURRENT_TIMESTAMP()
    AND threads_token_expires_at < TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
  `;

  const [rows] = await bigquery.query({ query });
  return rows.map((row: Record<string, unknown>) => ({
    user_id: row.user_id as string,
    instagram_user_id: row.instagram_user_id as string | null,
    instagram_username: row.instagram_username as string | null,
    instagram_profile_picture_url: row.instagram_profile_picture_url as string | null,
    access_token: row.access_token as string | null,
    token_expires_at: row.token_expires_at ? new Date(row.token_expires_at as string) : null,
    drive_folder_id: row.drive_folder_id as string | null,
    threads_user_id: row.threads_user_id as string | null,
    threads_username: row.threads_username as string | null,
    threads_access_token: row.threads_access_token as string | null,
    threads_token_expires_at: row.threads_token_expires_at ? new Date(row.threads_token_expires_at as string) : null,
    threads_profile_picture_url: row.threads_profile_picture_url as string | null,
    has_instagram: row.has_instagram as boolean | null,
    has_threads: row.has_threads as boolean | null,
  }));
}

// Instagram Storiesをupsert（新規挿入 + 既存のインサイト更新）
export async function upsertInstagramStories(stories: InstagramStory[]): Promise<{ newCount: number; updatedCount: number }> {
  if (stories.length === 0) return { newCount: 0, updatedCount: 0 };

  const userId = stories[0].user_id;

  // 既存のinstagram_idを取得
  const existingQuery = `
    SELECT instagram_id
    FROM \`mark-454114.analyca.instagram_stories\`
    WHERE user_id = @user_id
  `;
  const [existingRows] = await bigquery.query({
    query: existingQuery,
    params: { user_id: userId },
  });
  const existingIds = new Set(existingRows.map((r: { instagram_id: string }) => r.instagram_id));

  // 新規と既存を分離
  const newStories = stories.filter(story => !existingIds.has(story.instagram_id));
  const existingStories = stories.filter(story => existingIds.has(story.instagram_id));

  // 新規ストーリーを挿入
  if (newStories.length > 0) {
    const table = dataset.table('instagram_stories');
    await table.insert(newStories.map(story => ({
      ...story,
      // undefinedをnullに変換
      drive_image_url: story.drive_image_url ?? null,
      thumbnail_url: story.thumbnail_url ?? null,
      caption: story.caption ?? null,
      timestamp: story.timestamp.toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })));
    console.log(`${newStories.length}件の新規ストーリーを保存`);
  }

  // 既存ストーリーのインサイト+サムネイルを更新
  for (const story of existingStories) {
    const updateQuery = `
      UPDATE \`mark-454114.analyca.instagram_stories\`
      SET
        views = @views,
        reach = @reach,
        replies = @replies,
        total_interactions = @total_interactions,
        follows = @follows,
        profile_visits = @profile_visits,
        navigation = @navigation,
        thumbnail_url = @thumbnail_url,
        updated_at = CURRENT_TIMESTAMP()
      WHERE user_id = @user_id AND instagram_id = @instagram_id
    `;
    const [job] = await bigquery.createQueryJob({
      query: updateQuery,
      params: {
        user_id: story.user_id,
        instagram_id: story.instagram_id,
        views: story.views,
        reach: story.reach,
        replies: story.replies,
        total_interactions: story.total_interactions,
        follows: story.follows,
        profile_visits: story.profile_visits,
        navigation: story.navigation,
        thumbnail_url: story.thumbnail_url ?? null,
      },
    });
    await job.getQueryResults();
  }

  if (existingStories.length > 0) {
    console.log(`${existingStories.length}件のストーリーインサイトを更新`);
  }

  return { newCount: newStories.length, updatedCount: existingStories.length };
}

// Instagram Insightsをupsert（日付ベースで更新）
export async function upsertInstagramInsights(insights: InstagramInsights): Promise<void> {
  const query = `
    MERGE \`mark-454114.analyca.instagram_insights\` T
    USING (
      SELECT
        @id as id,
        @user_id as user_id,
        PARSE_DATE('%Y-%m-%d', @date) as date,
        @followers_count as followers_count,
        @posts_count as posts_count,
        @reach as reach,
        @engagement as engagement,
        @profile_views as profile_views,
        @website_clicks as website_clicks
    ) S
    ON T.user_id = S.user_id AND T.date = S.date
    WHEN MATCHED THEN
      UPDATE SET
        followers_count = S.followers_count,
        posts_count = S.posts_count,
        reach = S.reach,
        engagement = S.engagement,
        profile_views = S.profile_views,
        website_clicks = S.website_clicks
    WHEN NOT MATCHED THEN
      INSERT (id, user_id, date, followers_count, posts_count, reach, engagement, profile_views, website_clicks, created_at)
      VALUES (S.id, S.user_id, S.date, S.followers_count, S.posts_count, S.reach, S.engagement, S.profile_views, S.website_clicks, CURRENT_TIMESTAMP())
  `;

  const options = {
    query,
    params: {
      id: insights.id,
      user_id: insights.user_id,
      date: insights.date,
      followers_count: insights.followers_count,
      posts_count: insights.posts_count,
      reach: insights.reach,
      engagement: insights.engagement,
      profile_views: insights.profile_views,
      website_clicks: insights.website_clicks,
    },
  };

  await executeDML(options);
}

// Instagram Reelsをupsert（既存のリールは更新、新規は挿入）
export async function upsertInstagramReels(reels: InstagramReel[]): Promise<{ newCount: number; updatedCount: number }> {
  if (reels.length === 0) return { newCount: 0, updatedCount: 0 };

  const userId = reels[0].user_id;

  // 既存のinstagram_idを取得
  const existingQuery = `
    SELECT instagram_id
    FROM \`mark-454114.analyca.instagram_reels\`
    WHERE user_id = @user_id
  `;
  const [existingRows] = await bigquery.query({
    query: existingQuery,
    params: { user_id: userId },
  });
  const existingIds = new Set(existingRows.map((r: { instagram_id: string }) => r.instagram_id));

  // 新規と既存を分離
  const newReels = reels.filter(reel => !existingIds.has(reel.instagram_id));
  const existingReels = reels.filter(reel => existingIds.has(reel.instagram_id));

  // 新規リールを挿入
  if (newReels.length > 0) {
    const table = dataset.table('instagram_reels');
    await table.insert(newReels.map(reel => ({
      ...reel,
      // undefinedをnullに変換
      drive_image_url: reel.drive_image_url ?? null,
      thumbnail_url: reel.thumbnail_url ?? null,
      timestamp: reel.timestamp.toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })));
    console.log(`${newReels.length}件の新規リールを保存`);
  }

  // 既存リールのインサイト+サムネイルを更新
  for (const reel of existingReels) {
    const updateQuery = `
      UPDATE \`mark-454114.analyca.instagram_reels\`
      SET
        views = @views,
        reach = @reach,
        total_interactions = @total_interactions,
        like_count = @like_count,
        comments_count = @comments_count,
        saved = @saved,
        shares = @shares,
        video_view_total_time_hours = @video_view_total_time_hours,
        avg_watch_time_seconds = @avg_watch_time_seconds,
        thumbnail_url = @thumbnail_url,
        updated_at = CURRENT_TIMESTAMP()
      WHERE user_id = @user_id AND instagram_id = @instagram_id
    `;
    const [job] = await bigquery.createQueryJob({
      query: updateQuery,
      params: {
        user_id: reel.user_id,
        instagram_id: reel.instagram_id,
        views: reel.views,
        reach: reel.reach,
        total_interactions: reel.total_interactions,
        like_count: reel.like_count,
        comments_count: reel.comments_count,
        saved: reel.saved,
        shares: reel.shares,
        video_view_total_time_hours: reel.video_view_total_time_hours,
        avg_watch_time_seconds: reel.avg_watch_time_seconds,
        thumbnail_url: reel.thumbnail_url ?? null,
      },
    });
    await job.getQueryResults();
  }

  if (existingReels.length > 0) {
    console.log(`${existingReels.length}件のリールインサイトを更新`);
  }

  return { newCount: newReels.length, updatedCount: existingReels.length };
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
  threadsDailyPostStats: ThreadsDailyPostStats[];
}> {
  const [reels, stories, insights, lineData, threadsPosts, threadsDailyMetrics, threadsDailyPostStats] = await Promise.all([
    getUserReels(userId, 50),
    getUserStories(userId, 50),
    getUserInsights(userId, 30),
    getUserLineData(userId, 30),
    getUserThreadsPosts(userId, 500),
    getUserThreadsDailyMetrics(userId, 90),
    getUserThreadsDailyPostStats(userId, 90),
  ]);

  const threadsComments = await getThreadsCommentsForPosts(
    userId,
    threadsPosts.map((post) => post.threads_id)
  );

  return { reels, stories, insights, lineData, threadsPosts, threadsComments, threadsDailyMetrics, threadsDailyPostStats };
}

// 管理者用: 全ユーザー一覧取得（統計付き）
export interface AdminUserSummary {
  user_id: string;
  instagram_username: string | null;
  instagram_profile_picture_url: string | null;
  threads_username: string | null;
  threads_profile_picture_url: string | null;
  has_instagram: boolean;
  has_threads: boolean;
  created_at: Date | null;
  // Instagram統計
  ig_followers: number;
  ig_reels_count: number;
  ig_total_views: number;
  // Threads統計
  threads_followers: number;
  threads_posts_count: number;
  threads_total_views: number;
}

export async function getAllUsersWithStats(): Promise<AdminUserSummary[]> {
  const query = `
    WITH user_ig_stats AS (
      SELECT
        user_id,
        COUNT(*) as reels_count,
        COALESCE(SUM(views), 0) as total_views
      FROM \`${projectId}.analyca.instagram_reels\`
      GROUP BY user_id
    ),
    user_ig_followers AS (
      SELECT
        user_id,
        followers_count,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY date DESC) as rn
      FROM \`${projectId}.analyca.instagram_insights\`
    ),
    user_threads_stats AS (
      SELECT
        user_id,
        COUNT(*) as posts_count,
        COALESCE(SUM(views), 0) as total_views
      FROM \`${projectId}.analyca.threads_posts\`
      GROUP BY user_id
    ),
    user_threads_followers AS (
      SELECT
        user_id,
        followers_count,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY date DESC) as rn
      FROM \`${projectId}.analyca.threads_daily_metrics\`
    )
    SELECT
      u.user_id,
      u.instagram_username,
      u.instagram_profile_picture_url,
      u.threads_username,
      u.threads_profile_picture_url,
      COALESCE(u.has_instagram, false) as has_instagram,
      COALESCE(u.has_threads, false) as has_threads,
      u.created_at,
      COALESCE(igf.followers_count, 0) as ig_followers,
      COALESCE(igs.reels_count, 0) as ig_reels_count,
      COALESCE(igs.total_views, 0) as ig_total_views,
      COALESCE(tf.followers_count, 0) as threads_followers,
      COALESCE(ts.posts_count, 0) as threads_posts_count,
      COALESCE(ts.total_views, 0) as threads_total_views
    FROM \`${projectId}.analyca.users\` u
    LEFT JOIN user_ig_stats igs ON u.user_id = igs.user_id
    LEFT JOIN user_ig_followers igf ON u.user_id = igf.user_id AND igf.rn = 1
    LEFT JOIN user_threads_stats ts ON u.user_id = ts.user_id
    LEFT JOIN user_threads_followers tf ON u.user_id = tf.user_id AND tf.rn = 1
    ORDER BY u.created_at DESC
  `;

  const [rows] = await bigquery.query({ query });
  return rows as AdminUserSummary[];
}

// 管理者用: 全体統計取得
export interface AdminOverallStats {
  total_users: number;
  instagram_users: number;
  threads_users: number;
  total_ig_reels: number;
  total_ig_views: number;
  total_threads_posts: number;
  total_threads_views: number;
}

export async function getAdminOverallStats(): Promise<AdminOverallStats> {
  const query = `
    SELECT
      (SELECT COUNT(*) FROM \`${projectId}.analyca.users\`) as total_users,
      (SELECT COUNT(*) FROM \`${projectId}.analyca.users\` WHERE has_instagram = true) as instagram_users,
      (SELECT COUNT(*) FROM \`${projectId}.analyca.users\` WHERE has_threads = true) as threads_users,
      (SELECT COUNT(*) FROM \`${projectId}.analyca.instagram_reels\`) as total_ig_reels,
      (SELECT COALESCE(SUM(views), 0) FROM \`${projectId}.analyca.instagram_reels\`) as total_ig_views,
      (SELECT COUNT(*) FROM \`${projectId}.analyca.threads_posts\`) as total_threads_posts,
      (SELECT COALESCE(SUM(views), 0) FROM \`${projectId}.analyca.threads_posts\`) as total_threads_views
  `;

  const [rows] = await bigquery.query({ query });
  return rows[0] as AdminOverallStats;
}

// プロフィール画像URLを更新
export async function updateUserProfilePictures(
  userId: string,
  instagramProfilePictureUrl: string | null,
  threadsProfilePictureUrl: string | null
): Promise<void> {
  const updates: string[] = [];
  const params: Record<string, string | null> = { user_id: userId };

  if (instagramProfilePictureUrl) {
    updates.push('instagram_profile_picture_url = @instagram_profile_picture_url');
    params.instagram_profile_picture_url = instagramProfilePictureUrl;
  }

  if (threadsProfilePictureUrl) {
    updates.push('threads_profile_picture_url = @threads_profile_picture_url');
    params.threads_profile_picture_url = threadsProfilePictureUrl;
  }

  if (updates.length === 0) return;

  const query = `
    UPDATE \`mark-454114.analyca.users\`
    SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP()
    WHERE user_id = @user_id
  `;

  const [job] = await bigquery.createQueryJob({ query, params });
  await job.getQueryResults();
}

// ===== Subscription Management =====

/**
 * 仮ユーザーを作成（決済完了直後、オンボーディング前）
 * subscription_id と plan_id を持つユーザーレコードを先に作る
 */
export async function createPendingUser(userId: string, subscriptionData: {
  subscription_id: string;
  plan_id: string;
  subscription_status: string;
  subscription_created_at: Date;
  email?: string;
  trial_ends_at?: Date;
  transaction_token_id?: string;
}): Promise<string> {
  const query = `
    INSERT INTO \`mark-454114.analyca.users\` (
      user_id,
      email,
      subscription_id,
      plan_id,
      subscription_status,
      subscription_created_at,
      trial_ends_at,
      transaction_token_id,
      created_at,
      updated_at
    ) VALUES (
      @user_id,
      @email,
      @subscription_id,
      @plan_id,
      @subscription_status,
      @subscription_created_at,
      @trial_ends_at,
      @transaction_token_id,
      CURRENT_TIMESTAMP(),
      CURRENT_TIMESTAMP()
    )
  `;

  await executeDML({
    query,
    params: {
      user_id: userId,
      email: subscriptionData.email || null,
      subscription_id: subscriptionData.subscription_id,
      plan_id: subscriptionData.plan_id,
      subscription_status: subscriptionData.subscription_status,
      subscription_created_at: subscriptionData.subscription_created_at.toISOString(),
      trial_ends_at: subscriptionData.trial_ends_at ? subscriptionData.trial_ends_at.toISOString() : null,
      transaction_token_id: subscriptionData.transaction_token_id || null,
    },
    types: {
      subscription_created_at: 'TIMESTAMP',
      trial_ends_at: 'TIMESTAMP',
    },
  });

  return userId;
}

/**
 * transaction_token_id で既存ユーザーを検索（冪等性チェック用）
 * 同じトークンで複数回サブスク作成が呼ばれるのを防ぐ。
 */
export async function findUserByTransactionTokenId(transactionTokenId: string): Promise<{
  user_id: string;
  subscription_id: string | null;
  plan_id: string | null;
  subscription_status: string | null;
} | null> {
  const query = `
    SELECT user_id, subscription_id, plan_id, subscription_status
    FROM \`mark-454114.analyca.users\`
    WHERE transaction_token_id = @transaction_token_id
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const [rows] = await bigquery.query({
    query,
    params: { transaction_token_id: transactionTokenId },
  });
  if (rows.length === 0) return null;
  return {
    user_id: rows[0].user_id,
    subscription_id: rows[0].subscription_id || null,
    plan_id: rows[0].plan_id || null,
    subscription_status: rows[0].subscription_status || null,
  };
}

/**
 * ユーザーのサブスクリプション情報を更新
 */
export async function updateUserSubscription(userId: string, data: {
  subscription_id?: string;
  plan_id?: string;
  subscription_status?: string;
  subscription_created_at?: Date;
  subscription_expires_at?: Date;
}): Promise<void> {
  const updates: string[] = [];
  const params: Record<string, unknown> = { user_id: userId };

  if (data.subscription_id !== undefined) {
    updates.push('subscription_id = @subscription_id');
    params.subscription_id = data.subscription_id;
  }
  if (data.plan_id !== undefined) {
    updates.push('plan_id = @plan_id');
    params.plan_id = data.plan_id;
  }
  if (data.subscription_status !== undefined) {
    updates.push('subscription_status = @subscription_status');
    params.subscription_status = data.subscription_status;
  }
  if (data.subscription_created_at !== undefined) {
    updates.push('subscription_created_at = @subscription_created_at');
    params.subscription_created_at = data.subscription_created_at.toISOString();
  }
  if (data.subscription_expires_at !== undefined) {
    updates.push('subscription_expires_at = @subscription_expires_at');
    params.subscription_expires_at = data.subscription_expires_at.toISOString();
  }

  if (updates.length === 0) return;

  const query = `
    UPDATE \`mark-454114.analyca.users\`
    SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP()
    WHERE user_id = @user_id
  `;

  await executeDML({ query, params });
}

/**
 * subscription_id からユーザーを検索（Webhook用）
 */
export async function findUserBySubscriptionId(subscriptionId: string): Promise<User | null> {
  const query = `
    SELECT user_id, email, subscription_id, plan_id, subscription_status,
           instagram_username, threads_username
    FROM \`mark-454114.analyca.users\`
    WHERE subscription_id = @subscription_id
    LIMIT 1
  `;

  const [rows] = await bigquery.query({
    query,
    params: { subscription_id: subscriptionId },
  });

  return rows.length > 0 ? rows[0] : null;
}

/**
 * ユーザーのサブスクリプション状態を取得
 */
export async function getUserSubscriptionStatus(userId: string): Promise<{
  subscription_id: string | null;
  plan_id: string | null;
  subscription_status: string;
  subscription_created_at: string | null;
  subscription_expires_at: string | null;
  trial_ends_at: string | null;
}> {
  const query = `
    SELECT subscription_id, plan_id, subscription_status,
           FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', subscription_created_at) as subscription_created_at,
           FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', subscription_expires_at) as subscription_expires_at,
           FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', trial_ends_at) as trial_ends_at
    FROM \`mark-454114.analyca.users\`
    WHERE user_id = @user_id
    LIMIT 1
  `;

  const [rows] = await bigquery.query({
    query,
    params: { user_id: userId },
  });

  if (rows.length === 0) {
    return {
      subscription_id: null,
      plan_id: null,
      subscription_status: 'none',
      subscription_created_at: null,
      subscription_expires_at: null,
      trial_ends_at: null,
    };
  }

  return {
    subscription_id: rows[0].subscription_id || null,
    plan_id: rows[0].plan_id || null,
    subscription_status: rows[0].subscription_status || 'none',
    subscription_created_at: rows[0].subscription_created_at || null,
    subscription_expires_at: rows[0].subscription_expires_at || null,
    trial_ends_at: rows[0].trial_ends_at || null,
  };
}

/**
 * subscription_idでサブスクステータスを更新（Webhook用）
 */
export async function updateSubscriptionStatusBySubId(subscriptionId: string, status: string): Promise<void> {
  // status=current に遷移する時、subscription_created_at がまだ設定されていなければ CURRENT_TIMESTAMP を入れる
  // （trial期間中は NULL のまま → 初回決済成功でwebhook発火 → 日時が入る）
  const query = `
    UPDATE \`mark-454114.analyca.users\`
    SET
      subscription_status = @status,
      subscription_created_at = CASE
        WHEN @status = 'current' AND subscription_created_at IS NULL THEN CURRENT_TIMESTAMP()
        ELSE subscription_created_at
      END,
      updated_at = CURRENT_TIMESTAMP()
    WHERE subscription_id = @subscription_id
  `;

  await executeDML({
    query,
    params: { subscription_id: subscriptionId, status },
  });
}

/**
 * トライアルユーザーを作成（無料登録時）
 */
export async function createTrialUser(userId: string, data: {
  plan_id: string;
  trial_ends_at: Date;
  recurring_token_id?: string;
}): Promise<string> {
  const query = `
    INSERT INTO \`mark-454114.analyca.users\` (
      user_id,
      plan_id,
      subscription_status,
      trial_ends_at,
      recurring_token_id,
      created_at,
      updated_at
    ) VALUES (
      @user_id,
      @plan_id,
      'trial',
      @trial_ends_at,
      @recurring_token_id,
      CURRENT_TIMESTAMP(),
      CURRENT_TIMESTAMP()
    )
  `;

  await executeDML({
    query,
    params: {
      user_id: userId,
      plan_id: data.plan_id,
      trial_ends_at: data.trial_ends_at.toISOString(),
      recurring_token_id: data.recurring_token_id || null,
    },
    types: {
      trial_ends_at: 'TIMESTAMP',
    },
  });

  return userId;
}

/**
 * ユーザーにリカーリングトークンを登録（カード登録時）
 */
export async function updateUserRecurringToken(userId: string, recurringTokenId: string): Promise<void> {
  const query = `
    UPDATE \`mark-454114.analyca.users\`
    SET recurring_token_id = @recurring_token_id,
        updated_at = CURRENT_TIMESTAMP()
    WHERE user_id = @user_id
  `;

  await executeDML({
    query,
    params: {
      user_id: userId,
      recurring_token_id: recurringTokenId,
    },
  });
}

/**
 * トライアル期限切れ＋カード登録済みのユーザーを取得（cron用）
 */
export async function getTrialExpiredUsersWithCard(): Promise<Array<{
  user_id: string;
  plan_id: string;
  recurring_token_id: string;
}>> {
  const query = `
    SELECT user_id, plan_id, recurring_token_id
    FROM \`mark-454114.analyca.users\`
    WHERE subscription_status = 'trial'
      AND recurring_token_id IS NOT NULL
      AND trial_ends_at IS NOT NULL
      AND trial_ends_at <= CURRENT_TIMESTAMP()
  `;

  const [rows] = await bigquery.query({ query });
  return rows.map((row: Record<string, unknown>) => ({
    user_id: row.user_id as string,
    plan_id: row.plan_id as string,
    recurring_token_id: row.recurring_token_id as string,
  }));
}

/**
 * トライアル期限切れ＋カード未登録のユーザーを期限切れにする（cron用）
 */
export async function expireTrialUsersWithoutCard(): Promise<number> {
  const query = `
    UPDATE \`mark-454114.analyca.users\`
    SET subscription_status = 'expired',
        updated_at = CURRENT_TIMESTAMP()
    WHERE subscription_status = 'trial'
      AND (recurring_token_id IS NULL OR recurring_token_id = '')
      AND trial_ends_at IS NOT NULL
      AND trial_ends_at <= CURRENT_TIMESTAMP()
  `;

  await executeDML({ query });
  return 0;
}

// ==================== アフィリエイト関連 ====================

/**
 * アフィリエイトコードを発行・登録
 */
export async function registerAffiliate(userId: string, affiliateCode: string): Promise<void> {
  const query = `
    INSERT INTO \`mark-454114.analyca.affiliates\` (
      user_id, affiliate_code, commission_rate, total_referrals, total_commission, created_at
    ) VALUES (
      @user_id, @affiliate_code, 0.5, 0, 0, CURRENT_TIMESTAMP()
    )
  `;
  await executeDML({ query, params: { user_id: userId, affiliate_code: affiliateCode } });
}

/**
 * ユーザーのアフィリエイト情報を取得
 */
export async function getAffiliateByUserId(userId: string): Promise<{
  user_id: string;
  affiliate_code: string;
  commission_rate: number;
  total_referrals: number;
  total_commission: number;
  created_at: string;
} | null> {
  const query = `
    SELECT * FROM \`mark-454114.analyca.affiliates\`
    WHERE user_id = @user_id
    LIMIT 1
  `;
  const [rows] = await bigquery.query({ query, params: { user_id: userId } });
  if (!rows || rows.length === 0) return null;
  const row = rows[0];
  return {
    user_id: row.user_id,
    affiliate_code: row.affiliate_code,
    commission_rate: row.commission_rate,
    total_referrals: row.total_referrals,
    total_commission: row.total_commission,
    created_at: row.created_at?.value || row.created_at,
  };
}

/**
 * アフィリエイトコードで検索
 */
export async function getAffiliateByCode(code: string): Promise<{
  user_id: string;
  affiliate_code: string;
  commission_rate: number;
} | null> {
  const query = `
    SELECT user_id, affiliate_code, commission_rate
    FROM \`mark-454114.analyca.affiliates\`
    WHERE affiliate_code = @code
    LIMIT 1
  `;
  const [rows] = await bigquery.query({ query, params: { code } });
  if (!rows || rows.length === 0) return null;
  return {
    user_id: rows[0].user_id,
    affiliate_code: rows[0].affiliate_code,
    commission_rate: rows[0].commission_rate,
  };
}

/**
 * 紹介実績を記録
 */
export async function createReferral(data: {
  id: string;
  affiliate_code: string;
  referred_user_id: string;
  plan_id: string;
  payment_amount: number;
  commission_amount: number;
}): Promise<void> {
  const query = `
    INSERT INTO \`mark-454114.analyca.referrals\` (
      id, affiliate_code, referred_user_id, plan_id, payment_amount, commission_amount, status, created_at
    ) VALUES (
      @id, @affiliate_code, @referred_user_id, @plan_id, @payment_amount, @commission_amount, 'pending', CURRENT_TIMESTAMP()
    )
  `;
  await executeDML({ query, params: data });

  // affiliatesテーブルの集計を更新
  const updateQuery = `
    UPDATE \`mark-454114.analyca.affiliates\`
    SET total_referrals = total_referrals + 1,
        total_commission = total_commission + @commission_amount
    WHERE affiliate_code = @affiliate_code
  `;
  await executeDML({
    query: updateQuery,
    params: { affiliate_code: data.affiliate_code, commission_amount: data.commission_amount },
  });
}

/**
 * ユーザーの紹介実績一覧を取得
 */
export async function getReferralsByAffiliateCode(affiliateCode: string): Promise<Array<{
  id: string;
  plan_id: string;
  payment_amount: number;
  commission_amount: number;
  status: string;
  created_at: string;
}>> {
  const query = `
    SELECT id, plan_id, payment_amount, commission_amount, status, created_at
    FROM \`mark-454114.analyca.referrals\`
    WHERE affiliate_code = @affiliate_code
    ORDER BY created_at DESC
    LIMIT 100
  `;
  const [rows] = await bigquery.query({ query, params: { affiliate_code: affiliateCode } });
  return (rows || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    plan_id: row.plan_id as string,
    payment_amount: row.payment_amount as number,
    commission_amount: row.commission_amount as number,
    status: row.status as string,
    created_at: (row.created_at as { value?: string })?.value || String(row.created_at),
  }));
}

/**
 * ユーザーの最終ログイン日時を更新
 */
export async function updateLastLogin(
  userId: string,
  accessInfo?: {
    accessPath?: string;
    userAgent?: string;
  },
): Promise<void> {
  await ensureUserAccessLogsTable();

  await executeDML({
    query: `
      UPDATE \`mark-454114.analyca.users\`
      SET last_login_at = CURRENT_TIMESTAMP(),
          updated_at = CURRENT_TIMESTAMP()
      WHERE user_id = @user_id
    `,
    params: { user_id: userId },
  });

  await executeDML({
    query: `
      INSERT INTO \`${projectId}.analyca.user_access_logs\` (
        id,
        user_id,
        access_path,
        user_agent,
        accessed_at
      ) VALUES (
        GENERATE_UUID(),
        @user_id,
        @access_path,
        @user_agent,
        CURRENT_TIMESTAMP()
      )
    `,
    params: {
      user_id: userId,
      access_path: accessInfo?.accessPath || null,
      user_agent: accessInfo?.userAgent || null,
    },
  });
}

/**
 * アフィリエイトクリックを記録
 */
export async function recordAffiliateClick(data: {
  affiliate_code: string;
  referrer: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  user_agent: string;
  ip_hash: string;
}): Promise<void> {
  const query = `
    INSERT INTO \`mark-454114.analyca.affiliate_clicks\` (
      id, affiliate_code, referrer, utm_source, utm_medium, utm_campaign, user_agent, ip_hash, created_at
    ) VALUES (
      GENERATE_UUID(), @affiliate_code, @referrer, @utm_source, @utm_medium, @utm_campaign, @user_agent, @ip_hash, CURRENT_TIMESTAMP()
    )
  `;
  await executeDML({ query, params: data });
}

/**
 * アフィリエイトクリック数を取得
 */
export async function getAffiliateClickCount(affiliateCode: string): Promise<number> {
  const query = `
    SELECT COUNT(*) as count
    FROM \`mark-454114.analyca.affiliate_clicks\`
    WHERE affiliate_code = @affiliate_code
  `;
  const [rows] = await bigquery.query({ query, params: { affiliate_code: affiliateCode } });
  return rows[0]?.count || 0;
}

/**
 * コンバージョンイベントを記録
 */
export async function recordConversionEvent(data: {
  id: string;
  user_id: string;
  event_type: string;
  plan_id: string;
  amount: number;
  affiliate_code: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  referrer: string;
}): Promise<void> {
  const query = `
    INSERT INTO \`mark-454114.analyca.conversion_events\` (
      id, user_id, event_type, plan_id, amount, affiliate_code,
      utm_source, utm_medium, utm_campaign, utm_content, referrer, created_at
    ) VALUES (
      @id, @user_id, @event_type, @plan_id, @amount, @affiliate_code,
      @utm_source, @utm_medium, @utm_campaign, @utm_content, @referrer, CURRENT_TIMESTAMP()
    )
  `;
  await executeDML({ query, params: data });
}

// ========================================
// アフィリエイト: 振込先口座情報
// ========================================

export interface BankAccount {
  user_id: string;
  bank_name: string | null;
  branch_name: string | null;
  account_type: string;
  account_number: string | null;
  account_holder: string | null;
  has_invoice: boolean;
  invoice_number: string | null;
  identity_verified: boolean;
  identity_doc_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 振込先情報の保存（UPSERT）
 */
export async function upsertAffiliateBankAccount(data: {
  user_id: string;
  bank_name: string;
  branch_name: string;
  account_type: string;
  account_number: string;
  account_holder: string;
  has_invoice: boolean;
  invoice_number: string;
}): Promise<void> {
  const query = `
    MERGE \`mark-454114.analyca.affiliate_bank_accounts\` T
    USING (
      SELECT
        @user_id as user_id,
        @bank_name as bank_name,
        @branch_name as branch_name,
        @account_type as account_type,
        @account_number as account_number,
        @account_holder as account_holder,
        @has_invoice as has_invoice,
        @invoice_number as invoice_number
    ) S
    ON T.user_id = S.user_id
    WHEN MATCHED THEN
      UPDATE SET
        bank_name = S.bank_name,
        branch_name = S.branch_name,
        account_type = S.account_type,
        account_number = S.account_number,
        account_holder = S.account_holder,
        has_invoice = S.has_invoice,
        invoice_number = S.invoice_number,
        updated_at = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN
      INSERT (user_id, bank_name, branch_name, account_type, account_number, account_holder, has_invoice, invoice_number, created_at, updated_at)
      VALUES (S.user_id, S.bank_name, S.branch_name, S.account_type, S.account_number, S.account_holder, S.has_invoice, S.invoice_number, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
  `;
  await executeDML({
    query,
    params: {
      user_id: data.user_id,
      bank_name: data.bank_name,
      branch_name: data.branch_name,
      account_type: data.account_type,
      account_number: data.account_number,
      account_holder: data.account_holder,
      has_invoice: data.has_invoice,
      invoice_number: data.invoice_number,
    },
  });
}

/**
 * 振込先情報の取得
 */
export async function getAffiliateBankAccount(userId: string): Promise<BankAccount | null> {
  const query = `
    SELECT *
    FROM \`mark-454114.analyca.affiliate_bank_accounts\`
    WHERE user_id = @user_id
    LIMIT 1
  `;
  const [rows] = await bigquery.query({ query, params: { user_id: userId } });
  if (!rows || rows.length === 0) return null;
  const row = rows[0];
  return {
    user_id: row.user_id,
    bank_name: row.bank_name ?? null,
    branch_name: row.branch_name ?? null,
    account_type: row.account_type ?? 'savings',
    account_number: row.account_number ?? null,
    account_holder: row.account_holder ?? null,
    has_invoice: row.has_invoice ?? false,
    invoice_number: row.invoice_number ?? null,
    identity_verified: row.identity_verified ?? false,
    identity_doc_url: row.identity_doc_url ?? null,
    created_at: (row.created_at as { value?: string })?.value || String(row.created_at),
    updated_at: (row.updated_at as { value?: string })?.value || String(row.updated_at),
  };
}

/**
 * 本人確認ステータスの更新
 */
export async function updateIdentityVerification(userId: string, docUrl: string): Promise<void> {
  const query = `
    UPDATE \`mark-454114.analyca.affiliate_bank_accounts\`
    SET identity_verified = TRUE,
        identity_doc_url = @doc_url,
        updated_at = CURRENT_TIMESTAMP()
    WHERE user_id = @user_id
  `;
  await executeDML({ query, params: { user_id: userId, doc_url: docUrl } });
}

/**
 * 報酬確定（pending → confirmed）
 */
export async function confirmReferrals(affiliateCode: string, month: string): Promise<number> {
  const query = `
    UPDATE \`mark-454114.analyca.referrals\`
    SET status = 'confirmed'
    WHERE affiliate_code = @affiliate_code
      AND status = 'pending'
      AND FORMAT_TIMESTAMP('%Y-%m', created_at) = @month
  `;
  const [job] = await bigquery.createQueryJob({
    query,
    params: { affiliate_code: affiliateCode, month },
  });
  await job.getQueryResults();
  const metadata = await job.getMetadata();
  const affected = metadata[0]?.statistics?.query?.numDmlAffectedRows;
  return Number(affected) || 0;
}

/**
 * 報酬支払済み（confirmed → paid）
 */
export async function markReferralsPaid(affiliateCode: string, month: string): Promise<number> {
  const query = `
    UPDATE \`mark-454114.analyca.referrals\`
    SET status = 'paid'
    WHERE affiliate_code = @affiliate_code
      AND status = 'confirmed'
      AND FORMAT_TIMESTAMP('%Y-%m', created_at) = @month
  `;
  const [job] = await bigquery.createQueryJob({
    query,
    params: { affiliate_code: affiliateCode, month },
  });
  await job.getQueryResults();
  const metadata = await job.getMetadata();
  const affected = metadata[0]?.statistics?.query?.numDmlAffectedRows;
  return Number(affected) || 0;
}

/**
 * 月次報酬サマリー取得
 */
export async function getMonthlyRewardSummary(affiliateCode: string, month: string): Promise<{
  total_referrals: number;
  total_amount: number;
  commission_amount: number;
  withholding_tax: number;
  net_amount: number;
}> {
  const query = `
    SELECT
      COUNT(*) as total_referrals,
      COALESCE(SUM(payment_amount), 0) as total_amount,
      COALESCE(SUM(commission_amount), 0) as commission_amount
    FROM \`mark-454114.analyca.referrals\`
    WHERE affiliate_code = @affiliate_code
      AND FORMAT_TIMESTAMP('%Y-%m', created_at) = @month
  `;
  const [rows] = await bigquery.query({
    query,
    params: { affiliate_code: affiliateCode, month },
  });
  const row = rows[0] || { total_referrals: 0, total_amount: 0, commission_amount: 0 };
  const commission = Number(row.commission_amount) || 0;

  // インボイスなしの場合の源泉徴収: 10.21%
  const withholdingTax = Math.floor(commission * 0.1021);
  const netAmount = commission - withholdingTax;

  return {
    total_referrals: Number(row.total_referrals) || 0,
    total_amount: Number(row.total_amount) || 0,
    commission_amount: commission,
    withholding_tax: withholdingTax,
    net_amount: netAmount,
  };
}

/**
 * トライアル有料転換時にreferralのステータスをpending→confirmedに更新
 */
export async function confirmReferralByUserId(userId: string): Promise<void> {
  const query = `
    UPDATE \`mark-454114.analyca.referrals\`
    SET status = 'confirmed'
    WHERE referred_user_id = @user_id
      AND status = 'pending'
  `;
  await executeDML({ query, params: { user_id: userId } });
}

/**
 * アフィリエイトコード別のステータス別件数を取得
 */
export async function getReferralStatusCounts(affiliateCode: string): Promise<{
  pending_count: number;
  confirmed_count: number;
  paid_count: number;
}> {
  const query = `
    SELECT
      COUNTIF(status = 'pending') as pending_count,
      COUNTIF(status = 'confirmed') as confirmed_count,
      COUNTIF(status = 'paid') as paid_count
    FROM \`mark-454114.analyca.referrals\`
    WHERE affiliate_code = @affiliate_code
  `;
  const [rows] = await bigquery.query({ query, params: { affiliate_code: affiliateCode } });
  const row = rows[0] || {};
  return {
    pending_count: Number(row.pending_count) || 0,
    confirmed_count: Number(row.confirmed_count) || 0,
    paid_count: Number(row.paid_count) || 0,
  };
}
