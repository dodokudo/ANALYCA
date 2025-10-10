import { BigQuery } from '@google-cloud/bigquery';
import { v4 as uuidv4 } from 'uuid';

// BigQuery設定
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
});

const dataset = bigquery.dataset('analyca');

export interface User {
  user_id: string;
  instagram_user_id: string;
  instagram_username: string;
  access_token: string;
  token_expires_at: Date;
  drive_folder_id?: string;
  threads_user_id?: string;
  threads_username?: string;
  threads_access_token?: string;
  threads_token_expires_at?: Date;
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
        CURRENT_TIMESTAMP() as updated_at
    ) S
    ON T.user_id = S.user_id
    WHEN MATCHED THEN
      UPDATE SET
        instagram_user_id = S.instagram_user_id,
        instagram_username = S.instagram_username,
        access_token = S.access_token,
        token_expires_at = S.token_expires_at,
        updated_at = S.updated_at
    WHEN NOT MATCHED THEN
      INSERT (user_id, instagram_user_id, instagram_username, access_token, token_expires_at, created_at, updated_at)
      VALUES (S.user_id, S.instagram_user_id, S.instagram_username, S.access_token, S.token_expires_at, CURRENT_TIMESTAMP(), S.updated_at)
  `;

  const options = {
    query,
    params: {
      user_id: userId,
      instagram_user_id: userData.instagram_user_id,
      instagram_username: userData.instagram_username,
      access_token: userData.access_token,
      token_expires_at: userData.token_expires_at.toISOString(),
    },
  };

  await bigquery.query(options);
  return userId;
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

// Threads投稿データ保存
export async function insertThreadsPosts(posts: ThreadsPost[]): Promise<void> {
  if (posts.length === 0) return;

  const table = dataset.table('threads_posts');
  await table.insert(posts.map(post => ({
    ...post,
    timestamp: post.timestamp.toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })));
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
  return rows.map(row => ({
    ...row,
    timestamp: new Date(row.timestamp),
  }));
}

// 統合ダッシュボードデータ取得
export async function getUserDashboardData(userId: string): Promise<{
  reels: InstagramReel[];
  stories: InstagramStory[];
  insights: InstagramInsights[];
  lineData: LineDaily[];
  threadsPosts: ThreadsPost[];
}> {
  const [reels, stories, insights, lineData, threadsPosts] = await Promise.all([
    getUserReels(userId, 50),
    getUserStories(userId, 50),
    getUserInsights(userId, 30),
    getUserLineData(userId, 30),
    getUserThreadsPosts(userId, 50)
  ]);

  return { reels, stories, insights, lineData, threadsPosts };
}