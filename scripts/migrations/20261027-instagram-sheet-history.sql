ALTER TABLE `mark-454114.analyca.instagram_reels`
  ADD COLUMN IF NOT EXISTS title STRING,
  ADD COLUMN IF NOT EXISTS duration_seconds FLOAT64,
  ADD COLUMN IF NOT EXISTS follows INT64,
  ADD COLUMN IF NOT EXISTS imported_from STRING;
ALTER TABLE `mark-454114.analyca.instagram_stories`
  ADD COLUMN IF NOT EXISTS imported_from STRING;
ALTER TABLE `mark-454114.analyca.instagram_insights`
  ADD COLUMN IF NOT EXISTS sheet_follower_growth INT64,
  ADD COLUMN IF NOT EXISTS survey_responses INT64,
  ADD COLUMN IF NOT EXISTS imported_from STRING;
ALTER TABLE `mark-454114.analyca.line_daily`
  ADD COLUMN IF NOT EXISTS registrations INT64,
  ADD COLUMN IF NOT EXISTS imported_from STRING,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
CREATE TABLE IF NOT EXISTS `mark-454114.analyca.instagram_sheet_sources` (
  user_id STRING NOT NULL, spreadsheet_id STRING NOT NULL,
  line_enabled BOOL, last_synced_at TIMESTAMP, last_error STRING
);
