CREATE TABLE IF NOT EXISTS "prayer_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "body_ciphertext" text NOT NULL,
  "body_nonce" text NOT NULL,
  "body_tag" text NOT NULL,
  "contact_ciphertext" text,
  "contact_nonce" text,
  "contact_tag" text,
  "visibility" text DEFAULT 'LEADERS_ONLY' NOT NULL,
  "wants_reply" boolean DEFAULT false NOT NULL,
  "status" text DEFAULT 'NEW' NOT NULL,
  "assigned_slot" text,
  "claimed_by" text,
  "idempotency_key_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "claimed_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "delete_after" timestamp with time zone,
  CONSTRAINT "prayer_requests_visibility_check" CHECK ("visibility" IN ('LEADERS_ONLY', 'TRUSTED_TEAM')),
  CONSTRAINT "prayer_requests_status_check" CHECK ("status" IN ('NEW', 'PRAYING', 'COMPLETED')),
  CONSTRAINT "prayer_requests_contact_check" CHECK (
    ("wants_reply" = false AND "contact_ciphertext" IS NULL AND "contact_nonce" IS NULL AND "contact_tag" IS NULL)
    OR
    ("wants_reply" = true AND "contact_ciphertext" IS NOT NULL AND "contact_nonce" IS NOT NULL AND "contact_tag" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS "prayer_requests_idempotency_key_hash_uq"
  ON "prayer_requests" ("idempotency_key_hash");
CREATE INDEX IF NOT EXISTS "prayer_requests_queue_idx"
  ON "prayer_requests" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "prayer_requests_assigned_slot_idx"
  ON "prayer_requests" ("assigned_slot", "status");

CREATE TABLE IF NOT EXISTS "prayer_audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "prayer_id" uuid NOT NULL REFERENCES "prayer_requests"("id") ON DELETE CASCADE,
  "event_type" text NOT NULL,
  "actor_id" text,
  "actor_slot" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "prayer_audit_events_prayer_id_idx"
  ON "prayer_audit_events" ("prayer_id", "created_at");
CREATE INDEX IF NOT EXISTS "prayer_audit_events_event_type_idx"
  ON "prayer_audit_events" ("event_type");
