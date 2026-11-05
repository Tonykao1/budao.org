-- Campfire · one-time sparks, moderated conversations and user reports.
-- Apply in an approved database migration before enabling guest writes.
-- This migration is additive and never modifies existing photographs or routes.
BEGIN;
CREATE TABLE IF NOT EXISTS campfire_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id text NOT NULL,
  album_id text NOT NULL,
  parent_id uuid REFERENCES campfire_comments(id) ON DELETE SET NULL,
  visitor_hash text,
  display_name varchar(32) NOT NULL,
  body varchar(600) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','HIDDEN','DELETED','REJECTED')),
  official boolean NOT NULL DEFAULT false,
  consent_version varchar(32),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  moderated_at timestamptz,
  moderated_by text
);
CREATE INDEX IF NOT EXISTS campfire_comments_visible_idx
  ON campfire_comments(photo_id,status,created_at);
CREATE INDEX IF NOT EXISTS campfire_comments_queue_idx
  ON campfire_comments(status,created_at DESC);
CREATE INDEX IF NOT EXISTS campfire_comments_parent_idx
  ON campfire_comments(parent_id);

CREATE TABLE IF NOT EXISTS campfire_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_hash text NOT NULL,
  target_kind varchar(16) NOT NULL CHECK (target_kind IN ('photo','comment')),
  target_id text NOT NULL,
  album_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(visitor_hash,target_kind,target_id)
);
CREATE INDEX IF NOT EXISTS campfire_reactions_album_idx
  ON campfire_reactions(album_id,created_at);

CREATE TABLE IF NOT EXISTS campfire_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES campfire_comments(id) ON DELETE CASCADE,
  visitor_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  resolved_at timestamptz,
  UNIQUE(comment_id,visitor_hash)
);
CREATE INDEX IF NOT EXISTS campfire_reports_pending_idx
  ON campfire_reports(resolved_at,created_at DESC);

CREATE TABLE IF NOT EXISTS campfire_moderation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES campfire_comments(id) ON DELETE CASCADE,
  action text NOT NULL,
  previous_status text NOT NULL,
  actor_id text NOT NULL,
  reason varchar(120),
  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS campfire_moderation_audit_comment_idx
  ON campfire_moderation_audit(comment_id,created_at);
COMMIT;
