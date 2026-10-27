ALTER TABLE `mark-454114.analyca.instagram_sheet_sources`
  ADD COLUMN IF NOT EXISTS export_enabled BOOL,
  ADD COLUMN IF NOT EXISTS export_insights_start_date DATE,
  ADD COLUMN IF NOT EXISTS last_export_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_export_error STRING,
  ADD COLUMN IF NOT EXISTS export_lock STRING,
  ADD COLUMN IF NOT EXISTS export_lock_at TIMESTAMP;

-- Enable a source only after its legacy Instagram writers have been stopped.
-- LINE sync remains enabled and continues in the opposite direction.
