-- Metrics are collected by the existing reel sync, never by dashboard reads.
CREATE TABLE IF NOT EXISTS `mark-454114.analyca.instagram_reel_metric_snapshots` (
  user_id STRING NOT NULL,
  instagram_id STRING NOT NULL,
  snapshot_at TIMESTAMP NOT NULL,
  views INT64,
  reach INT64,
  likes INT64,
  comments INT64,
  saved INT64,
  shares INT64,
  avg_watch_seconds FLOAT64,
  total_watch_seconds FLOAT64,
  skip_rate FLOAT64,
  duration_seconds FLOAT64,
  status STRING
)
PARTITION BY DATE(snapshot_at)
CLUSTER BY user_id, instagram_id;
