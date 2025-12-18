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
    types: {
      threads_profile_picture_url: 'STRING',
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

// Threads投稿データ保存（MERGE文を使用 - ストリーミングバッファ制限を回避）
export async function insertThreadsPosts(posts: ThreadsPost[]): Promise<{ newCount: number; updatedCount: number }> {
  if (posts.length === 0) return { newCount: 0, updatedCount: 0 };

  let newCount = 0;
  let updatedCount = 0;

  // 各投稿をMERGE文で処理（ストリーミングインサートではなくDMLを使用）
  for (const post of posts) {
    const mergeQuery = `
      MERGE \`mark-454114.analyca.threads_posts\` T
      USING (
        SELECT
          @id as id,
          @user_id as user_id,
          @threads_id as threads_id,
          @text as text,
          TIMESTAMP(@timestamp) as timestamp,
          @permalink as permalink,
          @media_type as media_type,
          @is_quote_post as is_quote_post,
          @views as views,
          @likes as likes,
          @replies as replies,
          @reposts as reposts,
          @quotes as quotes,
          CURRENT_TIMESTAMP() as updated_at
      ) S
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

    await bigquery.query({
      query: mergeQuery,
      params: {
        id: post.id,
        user_id: post.user_id,
        threads_id: post.threads_id,
        text: post.text,
        timestamp: post.timestamp.toISOString(),
        permalink: post.permalink,
        media_type: post.media_type,
        is_quote_post: post.is_quote_post,
        views: post.views,
        likes: post.likes,
        replies: post.replies,
        reposts: post.reposts,
        quotes: post.quotes,
      },
    });

    newCount++;
  }

  console.log(`${posts.length}件のThreads投稿を処理（MERGE使用）`);
  return { newCount, updatedCount };
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

// Threadsコメントデータ保存（MERGE文を使用 - ストリーミングバッファ制限を回避）
export async function insertThreadsComments(comments: ThreadsComment[]): Promise<{ newCount: number; updatedCount: number }> {
  if (comments.length === 0) return { newCount: 0, updatedCount: 0 };

  let processedCount = 0;

  // 各コメントをMERGE文で処理（ストリーミングインサートではなくDMLを使用）
  for (const comment of comments) {
    try {
      const mergeQuery = `
        MERGE \`mark-454114.analyca.threads_comments\` T
        USING (
          SELECT
            @id as id,
            @user_id as user_id,
            @comment_id as comment_id,
            @parent_post_id as parent_post_id,
            @text as text,
            TIMESTAMP(@timestamp) as timestamp,
            @permalink as permalink,
            @has_replies as has_replies,
            @views as views,
            @depth as depth,
            CURRENT_TIMESTAMP() as updated_at
        ) S
        ON T.user_id = S.user_id AND T.comment_id = S.comment_id
        WHEN MATCHED THEN
          UPDATE SET
            views = S.views,
            updated_at = S.updated_at
        WHEN NOT MATCHED THEN
          INSERT (id, user_id, comment_id, parent_post_id, text, timestamp, permalink, has_replies, views, depth, created_at, updated_at)
          VALUES (S.id, S.user_id, S.comment_id, S.parent_post_id, S.text, S.timestamp, S.permalink, S.has_replies, S.views, S.depth, CURRENT_TIMESTAMP(), S.updated_at)
      `;

      await bigquery.query({
        query: mergeQuery,
        params: {
          id: comment.id,
          user_id: comment.user_id,
          comment_id: comment.comment_id,
          parent_post_id: comment.parent_post_id,
          text: comment.text,
          timestamp: comment.timestamp.toISOString(),
          permalink: comment.permalink,
          has_replies: comment.has_replies,
          views: comment.views,
          depth: comment.depth,
        },
      });

      processedCount++;
    } catch (e) {
      console.warn(`コメント保存エラー (comment_id: ${comment.comment_id}):`, e);
    }
  }

  console.log(`${processedCount}件のThreadsコメントを処理（MERGE使用）`);
  return { newCount: processedCount, updatedCount: 0 };
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

  // 既存ストーリーのインサイトを更新
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
        updated_at = CURRENT_TIMESTAMP()
      WHERE user_id = @user_id AND instagram_id = @instagram_id
    `;
    await bigquery.query({
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
      },
    });
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
        @date as date,
        @followers_count as followers_count,
        @posts_count as posts_count,
        @reach as reach,
        @engagement as engagement,
        @profile_views as profile_views,
        @website_clicks as website_clicks,
        CURRENT_TIMESTAMP() as updated_at
    ) S
    ON T.user_id = S.user_id AND T.date = S.date
    WHEN MATCHED THEN
      UPDATE SET
        followers_count = S.followers_count,
        posts_count = S.posts_count,
        reach = S.reach,
        engagement = S.engagement,
        profile_views = S.profile_views,
        website_clicks = S.website_clicks,
        updated_at = S.updated_at
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

  await bigquery.query(options);
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

  // 既存リールのインサイトを更新
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
        updated_at = CURRENT_TIMESTAMP()
      WHERE user_id = @user_id AND instagram_id = @instagram_id
    `;
    await bigquery.query({
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
      },
    });
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
