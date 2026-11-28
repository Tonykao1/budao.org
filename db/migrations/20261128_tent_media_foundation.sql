-- Additive foundation only. Do not run against production until reviewed.
CREATE TABLE IF NOT EXISTS tent_media_albums (
 id uuid PRIMARY KEY, owner_id text NOT NULL, route_id text,
 activity_date date NOT NULL, title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
 location text NOT NULL CHECK (length(location) BETWEEN 1 AND 240),
 state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','submitted','approved','publishing','published','withdrawn')),
 revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tent_media_assets (
 id uuid PRIMARY KEY, album_id uuid NOT NULL REFERENCES tent_media_albums(id),
 private_object_key text NOT NULL UNIQUE, sha256 char(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
 mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
 bytes integer NOT NULL CHECK (bytes BETWEEN 1 AND 2097152),
 caption text NOT NULL DEFAULT '', alt_text text NOT NULL DEFAULT '',
 position integer NOT NULL CHECK (position >= 0),
 consent_confirmed boolean NOT NULL DEFAULT false,
 approved boolean NOT NULL DEFAULT false CHECK (NOT approved OR consent_confirmed),
 hero_eligible boolean NOT NULL DEFAULT false,
 UNIQUE (album_id, sha256)
);
CREATE TABLE IF NOT EXISTS tent_media_audit (
 id uuid PRIMARY KEY, album_id uuid NOT NULL REFERENCES tent_media_albums(id),
 actor_id text NOT NULL, action text NOT NULL, revision integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tent_media_owner_idx ON tent_media_albums(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS tent_media_asset_album_idx ON tent_media_assets(album_id,position);
