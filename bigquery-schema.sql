-- ANALYCAのBigQueryテーブル設計（GASスプレッドシート構造準拠）

-- 1. ユーザー情報テーブル
CREATE TABLE `mark-454114.analyca.users` (
  user_id STRING NOT NULL,
  instagram_user_id STRING,
  instagram_username STRING,
  access_token STRING,
  token_expires_at TIMESTAMP,
  drive_folder_id STRING,
  threads_user_id STRING,
  threads_username STRING,
  threads_access_token STRING,
  threads_token_expires_at TIMESTAMP,
  has_instagram BOOL DEFAULT FALSE,
  has_threads BOOL DEFAULT FALSE,
  subscription_id STRING,
  plan_id STRING,
  subscription_status STRING DEFAULT 'none',
  subscription_created_at TIMESTAMP,
  subscription_expires_at TIMESTAMP,
  recurring_token_id STRING,
  trial_ends_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- 2. Instagram Reels データテーブル（GAS「reel rawdata」準拠）
CREATE TABLE `mark-454114.analyca.instagram_reels` (
  id STRING NOT NULL,
  user_id STRING NOT NULL,
  instagram_id STRING NOT NULL,
  caption STRING,
  media_product_type STRING,
  media_type STRING,
  permalink STRING,
  timestamp TIMESTAMP,
  views INT64,
  reach INT64,
  total_interactions INT64,
  like_count INT64,
  comments_count INT64,
  saved INT64,
  shares INT64,
  video_view_total_time_hours STRING,
  avg_watch_time_seconds FLOAT64,
  drive_image_url STRING,
  thumbnail_url STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- 3. Instagram Stories データテーブル（GAS「stories rawdata」準拠）
CREATE TABLE `mark-454114.analyca.instagram_stories` (
  id STRING NOT NULL,
  user_id STRING NOT NULL,
  instagram_id STRING NOT NULL,
  drive_image_url STRING,
  thumbnail_url STRING,
  timestamp TIMESTAMP,
  views INT64,
  reach INT64,
  replies INT64,
  caption STRING,
  total_interactions INT64,
  follows INT64,
  profile_visits INT64,
  navigation INT64,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- 4. Instagram アカウントインサイト（GAS「Instagram insight」準拠）
CREATE TABLE `mark-454114.analyca.instagram_insights` (
  id STRING NOT NULL,
  user_id STRING NOT NULL,
  date DATE,
  followers_count INT64,
  posts_count INT64,
  reach INT64,
  engagement INT64,
  profile_views INT64,
  website_clicks INT64,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- 5. LINE日次データテーブル（GAS「LINE daily」準拠）
CREATE TABLE `mark-454114.analyca.line_daily` (
  id STRING NOT NULL,
  user_id STRING NOT NULL,
  date DATE,
  account_name STRING,
  followers INT64,
  targeted_reaches INT64,
  blocks INT64,
  broadcast INT64,
  targeting INT64,
  auto_response INT64,
  welcome_response INT64,
  chat INT64,
  api_broadcast INT64,
  api_push INT64,
  api_multicast INT64,
  api_narrowcast INT64,
  api_reply INT64,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- 6. Threads 投稿データテーブル
CREATE TABLE `mark-454114.analyca.threads_posts` (
  id STRING NOT NULL,
  user_id STRING NOT NULL,
  threads_id STRING NOT NULL,
  text STRING,
  timestamp TIMESTAMP,
  permalink STRING,
  media_type STRING,
  is_quote_post BOOL,
  views INT64,
  likes INT64,
  replies INT64,
  reposts INT64,
  quotes INT64,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- インデックス作成
CREATE INDEX idx_users_instagram_user_id ON `mark-454114.analyca.users`(instagram_user_id);
CREATE INDEX idx_users_threads_user_id ON `mark-454114.analyca.users`(threads_user_id);
CREATE INDEX idx_reels_user_timestamp ON `mark-454114.analyca.instagram_reels`(user_id, timestamp DESC);
CREATE INDEX idx_stories_user_timestamp ON `mark-454114.analyca.instagram_stories`(user_id, timestamp DESC);
CREATE INDEX idx_insights_user_date ON `mark-454114.analyca.instagram_insights`(user_id, date DESC);
CREATE INDEX idx_line_user_date ON `mark-454114.analyca.line_daily`(user_id, date DESC);
CREATE INDEX idx_threads_user_timestamp ON `mark-454114.analyca.threads_posts`(user_id, timestamp DESC);

-- ALTER TABLE: トライアル/無料登録対応カラム追加
ALTER TABLE `mark-454114.analyca.users` ADD COLUMN IF NOT EXISTS recurring_token_id STRING;
ALTER TABLE `mark-454114.analyca.users` ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP;
