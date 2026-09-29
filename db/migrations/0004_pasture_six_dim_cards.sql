-- Six-dimensional Budao cards: 4 × 13 × 2 × 6 × 2 × 6 = 7488.
-- First series publicly opens 7000 shuffled slots. Slots 7000..7487 are reserved (488).
-- DRAFT by default. This migration alone never starts issuance.
CREATE TABLE IF NOT EXISTS pasture_card_series (
 series_id text PRIMARY KEY,
 calligraphy text NOT NULL,
 total_capacity integer NOT NULL DEFAULT 7488 CHECK (total_capacity=7488),
 public_limit integer NOT NULL DEFAULT 7000 CHECK (public_limit BETWEEN 1 AND 7488),
 status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','PAUSED','CLOSED')),
 created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO pasture_card_series(series_id,calligraphy,total_capacity,public_limit,status)
VALUES ('CSCZ-001','创始成终',7488,7000,'DRAFT')
ON CONFLICT(series_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS pasture_card_claims (
 claim_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 series_id text NOT NULL REFERENCES pasture_card_series(series_id),
 release_slot integer NOT NULL CHECK (release_slot BETWEEN 0 AND 7487),
 combination_code integer GENERATED ALWAYS AS (((release_slot * 4871 + 2026) % 7488)) STORED,
 status text NOT NULL CHECK (status IN ('reserved','assigned')),
 reservation_hash text,
 reserved_by text,
 reservation_expires_at timestamptz,
 assigned_to text,
 assigned_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT pasture_card_series_slot_uq UNIQUE(series_id,release_slot),
 CONSTRAINT pasture_card_reservation_shape CHECK (
  (status='reserved' AND reservation_hash IS NOT NULL AND reserved_by IS NOT NULL
    AND reservation_expires_at IS NOT NULL AND assigned_to IS NULL AND assigned_at IS NULL)
  OR
  (status='assigned' AND assigned_to IS NOT NULL AND assigned_at IS NOT NULL
    AND reservation_hash IS NULL AND reservation_expires_at IS NULL)
 )
);
CREATE UNIQUE INDEX IF NOT EXISTS pasture_card_series_code_uq
 ON pasture_card_claims(series_id,combination_code);
CREATE UNIQUE INDEX IF NOT EXISTS pasture_card_assignee_uq
 ON pasture_card_claims(series_id,assigned_to) WHERE status='assigned';
CREATE INDEX IF NOT EXISTS pasture_card_reservation_expiry_idx
 ON pasture_card_claims(series_id,reservation_expires_at) WHERE status='reserved';

-- Assignment is permanent. A separate series namespace permits reuse of six-dimensional
-- values under a new calligraphy while keeping historical identities unique.
CREATE OR REPLACE FUNCTION pasture_card_no_unassign() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status='assigned' THEN
  RAISE EXCEPTION 'An assigned Budao identity cannot be changed or deleted';
 END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
DROP TRIGGER IF EXISTS pasture_card_assignment_immutable ON pasture_card_claims;
CREATE TRIGGER pasture_card_assignment_immutable
 BEFORE UPDATE OR DELETE ON pasture_card_claims
 FOR EACH ROW EXECUTE FUNCTION pasture_card_no_unassign();

-- Caller must derive subject and reservation hash from a verified server-side session.
-- Do not expose this database function as an unauthenticated public HTTP endpoint.
CREATE OR REPLACE FUNCTION reserve_pasture_card(
 p_series text,p_subject text,p_reservation_hash text
) RETURNS TABLE(claim uuid,combination integer,expires timestamptz)
LANGUAGE plpgsql AS $$
DECLARE v_limit integer;v_slot integer;v_status text;
BEGIN
 IF length(coalesce(p_subject,''))<1 OR length(coalesce(p_reservation_hash,''))<32 THEN
  RAISE EXCEPTION 'A verified subject and secret hash are required';
 END IF;
 SELECT s.public_limit,s.status INTO v_limit,v_status
 FROM pasture_card_series s WHERE s.series_id=p_series FOR UPDATE;
 IF NOT FOUND OR v_status<>'ACTIVE' THEN RAISE EXCEPTION 'Series is not accepting assignments'; END IF;
 DELETE FROM pasture_card_claims c WHERE c.series_id=p_series
  AND c.status='reserved' AND c.reservation_expires_at<=now();
 IF EXISTS(SELECT 1 FROM pasture_card_claims c
           WHERE c.series_id=p_series AND c.assigned_to=p_subject AND c.status='assigned') THEN
  RAISE EXCEPTION 'This subject has an assigned card in the series';
 END IF;
 SELECT candidate.slot INTO v_slot FROM generate_series(0,v_limit-1) candidate(slot)
 WHERE NOT EXISTS (
  SELECT 1 FROM pasture_card_claims c WHERE c.series_id=p_series
   AND c.release_slot=candidate.slot
 ) ORDER BY random() LIMIT 1;
 IF v_slot IS NULL THEN RAISE EXCEPTION 'Public issuance pool is full'; END IF;
 RETURN QUERY INSERT INTO pasture_card_claims
  (series_id,release_slot,status,reservation_hash,reserved_by,reservation_expires_at)
 VALUES (p_series,v_slot,'reserved',p_reservation_hash,p_subject,now()+interval '15 minutes')
 RETURNING claim_id,combination_code,reservation_expires_at;
END $$;

CREATE OR REPLACE FUNCTION assign_pasture_card(
 p_series text,p_subject text,p_reservation_hash text
) RETURNS TABLE(claim uuid,combination integer)
LANGUAGE plpgsql AS $$
DECLARE v_status text;v_claim uuid;v_code integer;
BEGIN
 SELECT s.status INTO v_status FROM pasture_card_series s
 WHERE s.series_id=p_series FOR UPDATE;
 IF NOT FOUND OR v_status NOT IN ('ACTIVE','PAUSED') THEN RAISE EXCEPTION 'Series is not assignable'; END IF;
 SELECT c.claim_id,c.combination_code INTO v_claim,v_code
 FROM pasture_card_claims c WHERE c.series_id=p_series AND c.status='reserved'
 AND c.reserved_by=p_subject AND c.reservation_hash=p_reservation_hash
 AND c.reservation_expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Valid reservation not found'; END IF;
 UPDATE pasture_card_claims c SET status='assigned',assigned_to=p_subject,assigned_at=now(),
  reservation_hash=NULL,reservation_expires_at=NULL,reserved_by=NULL
 WHERE c.claim_id=v_claim;
 -- The unused first draw (if any) is returned to the available public pool.
 DELETE FROM pasture_card_claims c WHERE c.series_id=p_series
 AND c.status='reserved' AND c.reserved_by=p_subject;
 RETURN QUERY SELECT v_claim,v_code;
END $$;
