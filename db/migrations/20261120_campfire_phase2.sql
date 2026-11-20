-- Campfire Phase 2 / Sparks to Steps: private inbox, two-sided consent, private letters.
-- No real names, phone numbers, email addresses, GPS or cross-device tracking.
CREATE TABLE IF NOT EXISTS campfire_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_hash char(64) NOT NULL,
  comment_id uuid NOT NULL REFERENCES campfire_comments(id) ON DELETE CASCADE,
  kind varchar(16) NOT NULL CHECK (kind IN ('REPLY')),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  read_at timestamptz,
  UNIQUE(recipient_hash,kind,comment_id)
);
CREATE INDEX IF NOT EXISTS campfire_notifications_recipient_idx
  ON campfire_notifications(recipient_hash,created_at DESC);

CREATE TABLE IF NOT EXISTS campfire_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_hash char(64) NOT NULL,
  recipient_hash char(64) NOT NULL,
  source_comment_id uuid NOT NULL REFERENCES campfire_comments(id),
  album_id text NOT NULL,
  photo_id text NOT NULL,
  intro varchar(240) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','ACCEPTED','DECLINED','REVOKED')),
  requested_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  expires_at timestamptz NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  CHECK (sender_hash <> recipient_hash),
  UNIQUE(sender_hash,recipient_hash,album_id)
);
CREATE INDEX IF NOT EXISTS campfire_connections_recipient_idx
  ON campfire_connections(recipient_hash,requested_at DESC);
CREATE INDEX IF NOT EXISTS campfire_connections_sender_idx
  ON campfire_connections(sender_hash,requested_at DESC);

CREATE TABLE IF NOT EXISTS campfire_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES campfire_connections(id) ON DELETE CASCADE,
  sender_hash char(64) NOT NULL,
  body varchar(500) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS campfire_letters_thread_idx
  ON campfire_letters(connection_id,created_at ASC);
