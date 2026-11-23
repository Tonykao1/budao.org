-- Only the ministry is allowed to issue step cards. Delivery is NOT issuance.
-- Online issuance reserves a secret for a specific registered resident.
-- Trail issuance is a ministry-controlled bearer card until redeemed.
ALTER TABLE pasture_cards ADD COLUMN IF NOT EXISTS issuer_id text;
ALTER TABLE pasture_cards ADD COLUMN IF NOT EXISTS authorization_ref text;
ALTER TABLE pasture_cards ADD COLUMN IF NOT EXISTS delivery_channel text;
ALTER TABLE pasture_cards ADD COLUMN IF NOT EXISTS reserved_for_user_id uuid REFERENCES pasture_users(id) ON DELETE SET NULL;
ALTER TABLE pasture_cards ADD CONSTRAINT pasture_cards_channel_check
 CHECK (delivery_channel IS NULL OR delivery_channel IN ('ONLINE','TRAIL'));
CREATE UNIQUE INDEX IF NOT EXISTS pasture_cards_genesis_only_uq
 ON pasture_cards (authorization_ref) WHERE authorization_ref='GENESIS-0001';
CREATE INDEX IF NOT EXISTS pasture_cards_reservation_idx ON pasture_cards (reserved_for_user_id)
 WHERE reserved_for_user_id IS NOT NULL AND status='ISSUED';

-- New issues must carry authorization and provenance. Existing issued cards
-- were created before this policy and cannot be retroactively attributed.
-- CLI and store layer reject new anonymous issuances.
