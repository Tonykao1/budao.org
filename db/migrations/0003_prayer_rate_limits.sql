CREATE TABLE IF NOT EXISTS "prayer_rate_limits" (
  "key_hash" text PRIMARY KEY NOT NULL,
  "window_started_at" timestamp with time zone NOT NULL,
  "count" integer DEFAULT 1 NOT NULL
);
