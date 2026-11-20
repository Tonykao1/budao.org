-- Stage 2: in-site return inbox, mutual-consent invitations, private chat.
-- No email/phone fields or silent external notifications.
CREATE TABLE IF NOT EXISTS campfire_peer_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id text NOT NULL,
  sender_hash char(64) NOT NULL,
  recipient_hash char(64) NOT NULL,
  sender_name varchar(32) NOT NULL,
  recipient_name varchar(32) NOT NULL,
  target_comment_id uuid NOT NULL REFERENCES campfire_comments(id),
  note varchar(200) NOT NULL DEFAULT '',
  status varchar(16) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','ACCEPTED','DECLINED','CANCELLED','BLOCKED')),
  sender_wants_walk boolean NOT NULL DEFAULT false,
  recipient_wants_walk boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(sender_hash,target_comment_id),
  CHECK (sender_hash <> recipient_hash)
);
CREATE INDEX IF NOT EXISTS campfire_peer_invites_recipient_idx
  ON campfire_peer_invites(recipient_hash,created_at DESC);
CREATE INDEX IF NOT EXISTS campfire_peer_invites_sender_idx
  ON campfire_peer_invites(sender_hash,created_at DESC);

CREATE TABLE IF NOT EXISTS campfire_private_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES campfire_peer_invites(id) ON DELETE CASCADE,
  sender_hash char(64) NOT NULL,
  body varchar(300) NOT NULL,
  status varchar(12) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','REDACTED')),
  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS campfire_private_messages_invite_idx
  ON campfire_private_messages(invite_id,created_at);

CREATE TABLE IF NOT EXISTS campfire_private_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES campfire_peer_invites(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES campfire_private_messages(id) ON DELETE CASCADE,
  reporter_hash char(64) NOT NULL,
  reason varchar(120) NOT NULL DEFAULT '不适当内容',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  resolved_at timestamptz,
  UNIQUE(message_id,reporter_hash)
);
CREATE INDEX IF NOT EXISTS campfire_private_reports_queue_idx
  ON campfire_private_reports(resolved_at,created_at DESC);

CREATE TABLE IF NOT EXISTS campfire_inbox_state (
  visitor_hash char(64) PRIMARY KEY,
  last_read_at timestamptz NOT NULL DEFAULT NOW()
);
