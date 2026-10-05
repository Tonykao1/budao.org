CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS pasture_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash text NOT NULL,
  email_masked text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','DELETED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pasture_users_email_hash_uq ON pasture_users(email_hash);
CREATE INDEX IF NOT EXISTS pasture_users_status_idx ON pasture_users(status);

CREATE TABLE IF NOT EXISTS pasture_email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pasture_email_verifications_lookup_idx ON pasture_email_verifications(email_hash, created_at);
CREATE INDEX IF NOT EXISTS pasture_email_verifications_expiry_idx ON pasture_email_verifications(expires_at, consumed_at);

CREATE TABLE IF NOT EXISTS pasture_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES pasture_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  user_agent_summary text
);
CREATE UNIQUE INDEX IF NOT EXISTS pasture_sessions_token_hash_uq ON pasture_sessions(token_hash);
CREATE INDEX IF NOT EXISTS pasture_sessions_user_id_idx ON pasture_sessions(user_id);
CREATE INDEX IF NOT EXISTS pasture_sessions_active_idx ON pasture_sessions(expires_at, revoked_at);

CREATE TABLE IF NOT EXISTS pasture_sheep (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES pasture_users(id) ON DELETE CASCADE,
  body_color text NOT NULL,
  head_color text NOT NULL,
  marking text NOT NULL DEFAULT 'NONE' CHECK (marking IN ('NONE','FACE','BACK','SOCKS')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pasture_sheep_user_id_uq ON pasture_sheep(user_id);
