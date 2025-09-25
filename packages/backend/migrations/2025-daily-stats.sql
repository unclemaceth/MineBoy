-- Daily stats table for network statistics
CREATE TABLE IF NOT EXISTS daily_stats (
  day_utc        DATE PRIMARY KEY,     -- e.g. 2025-09-25
  total_miners   INTEGER NOT NULL,
  total_carts    INTEGER NOT NULL,
  total_wei_text TEXT    NOT NULL,     -- keep as TEXT to avoid bigint overflow
  total_claims   INTEGER NOT NULL,
  computed_at_ms BIGINT NOT NULL
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_daily_stats_day ON daily_stats(day_utc DESC);
