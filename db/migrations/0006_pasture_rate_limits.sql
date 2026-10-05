CREATE TABLE IF NOT EXISTS pasture_rate_limits (
  key_hash TEXT PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  count INTEGER NOT NULL DEFAULT 1
);
