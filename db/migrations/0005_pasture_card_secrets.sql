-- Step-card release credentials: public serial, private keyed digest, one-time redemption.
-- There are NO plaintext passwords, sample secrets or developer unlocks in the database.
ALTER TABLE pasture_users ADD COLUMN IF NOT EXISTS card_activated_at timestamptz;

CREATE TABLE IF NOT EXISTS pasture_cards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 serial text NOT NULL UNIQUE,
 secret_digest text NOT NULL UNIQUE,
 secret_version text NOT NULL DEFAULT 'v1',
 batch_id text NOT NULL,
 status text NOT NULL DEFAULT 'ISSUED'
  CHECK (status IN ('ISSUED','ACTIVATED','REVOKED')),
 activated_by_user_id uuid REFERENCES pasture_users(id) ON DELETE SET NULL,
 issued_at timestamptz NOT NULL DEFAULT now(),
 activated_at timestamptz,
 revoked_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS pasture_cards_active_resident_uq
 ON pasture_cards (activated_by_user_id) WHERE status='ACTIVATED';
CREATE INDEX IF NOT EXISTS pasture_cards_batch_idx ON pasture_cards (batch_id,issued_at);

CREATE TABLE IF NOT EXISTS pasture_card_attempts (
 user_id uuid PRIMARY KEY REFERENCES pasture_users(id) ON DELETE CASCADE,
 attempts integer NOT NULL DEFAULT 0,
 window_started_at timestamptz NOT NULL DEFAULT now()
);

-- Operational security:
-- * Only offline production issuer may INSERT into pasture_cards.
-- * Only authenticated card redemption may UPDATE activation columns.
-- * No online endpoint may reveal secret_digest or password.
-- * Revocation requires an authenticated operator workflow, not a public endpoint.
