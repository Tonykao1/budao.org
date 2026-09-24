CREATE TABLE IF NOT EXISTS "dao_records" (
  "id" uuid PRIMARY KEY NOT NULL,
  "dao_code" text NOT NULL,
  "status" text DEFAULT 'PENDING_REVIEW' NOT NULL,
  "frozen" boolean DEFAULT false NOT NULL,
  "publisher_id" text NOT NULL,
  "publisher_slot" text NOT NULL,
  "publisher_name" text DEFAULT '' NOT NULL,
  "devotional_date" text NOT NULL,
  "book_code" text NOT NULL,
  "chapter_start" integer NOT NULL,
  "chapter_end" integer NOT NULL,
  "payload" jsonb NOT NULL,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "published_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "dao_records_dao_code_uq" ON "dao_records" USING btree ("dao_code");
CREATE INDEX IF NOT EXISTS "dao_records_status_idx" ON "dao_records" USING btree ("status");
CREATE INDEX IF NOT EXISTS "dao_records_publisher_id_idx" ON "dao_records" USING btree ("publisher_id");
CREATE INDEX IF NOT EXISTS "dao_records_scripture_idx" ON "dao_records" USING btree ("book_code", "chapter_start", "chapter_end");
