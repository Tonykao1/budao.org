-- Apply after the foundation migration to the designated media database.
CREATE TABLE tent_media_objects (
 asset_id uuid PRIMARY KEY REFERENCES tent_media_assets(id) ON DELETE CASCADE,
 master bytea NOT NULL CHECK (octet_length(master) BETWEEN 1 AND 2097152),
 display bytea NOT NULL CHECK (octet_length(display) BETWEEN 1 AND 2097152)
);
ALTER TABLE tent_media_albums ADD COLUMN published_on date;
