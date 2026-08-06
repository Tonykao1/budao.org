CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS stewardship_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  steward_code text NOT NULL,
  display_name text NOT NULL,
  city text,
  introduction text,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS stewardship_users_steward_code_uq
  ON stewardship_users (steward_code);
CREATE INDEX IF NOT EXISTS stewardship_users_status_idx
  ON stewardship_users (status);

CREATE TABLE IF NOT EXISTS passkey_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES stewardship_users(id) ON DELETE CASCADE,
  credential_id text NOT NULL,
  public_key text NOT NULL,
  counter integer NOT NULL DEFAULT 0,
  transports jsonb NOT NULL DEFAULT '[]'::jsonb,
  device_type text,
  backed_up boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS passkey_credentials_credential_id_uq
  ON passkey_credentials (credential_id);
CREATE INDEX IF NOT EXISTS passkey_credentials_user_id_idx
  ON passkey_credentials (user_id);

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_hash text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('registration', 'authentication')),
  provisional_user_id uuid,
  user_id uuid REFERENCES stewardship_users(id) ON DELETE CASCADE,
  intent_id uuid,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webauthn_challenges_active_idx
  ON webauthn_challenges (purpose, expires_at, consumed_at);
CREATE INDEX IF NOT EXISTS webauthn_challenges_user_id_idx
  ON webauthn_challenges (user_id);

CREATE TABLE IF NOT EXISTS stewardship_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES stewardship_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  user_agent_summary text
);

CREATE UNIQUE INDEX IF NOT EXISTS stewardship_sessions_token_hash_uq
  ON stewardship_sessions (token_hash);
CREATE INDEX IF NOT EXISTS stewardship_sessions_user_id_idx
  ON stewardship_sessions (user_id);

CREATE TABLE IF NOT EXISTS pending_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce_hash text NOT NULL,
  intended_action text NOT NULL CHECK (intended_action IN ('ENTRUST', 'REQUEST')),
  target_id text,
  return_path text NOT NULL DEFAULT '/contact.html',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pending_intents_nonce_hash_uq
  ON pending_intents (nonce_hash);
CREATE INDEX IF NOT EXISTS pending_intents_active_idx
  ON pending_intents (intended_action, expires_at, consumed_at);

CREATE TABLE IF NOT EXISTS recovery_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES stewardship_users(id) ON DELETE CASCADE,
  type text NOT NULL,
  encrypted_value text NOT NULL,
  lookup_hmac text NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recovery_contacts_lookup_hmac_idx
  ON recovery_contacts (lookup_hmac);
CREATE INDEX IF NOT EXISTS recovery_contacts_user_id_idx
  ON recovery_contacts (user_id);

CREATE TABLE IF NOT EXISTS recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES stewardship_users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS recovery_codes_code_hash_uq
  ON recovery_codes (code_hash);
CREATE INDEX IF NOT EXISTS recovery_codes_user_id_idx
  ON recovery_codes (user_id);

CREATE TABLE IF NOT EXISTS stewardship_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES stewardship_users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  actor_user_id uuid REFERENCES stewardship_users(id) ON DELETE SET NULL,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stewardship_audit_events_event_type_idx
  ON stewardship_audit_events (event_type);
CREATE INDEX IF NOT EXISTS stewardship_audit_events_user_id_idx
  ON stewardship_audit_events (user_id);
