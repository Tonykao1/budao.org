-- A mutual wish to walk is neither a booking nor a record of attendance.
-- No dates, coordinates, contact details or identifying fields.
CREATE TABLE IF NOT EXISTS campfire_walk_intentions (
  connection_id uuid NOT NULL REFERENCES campfire_connections(id) ON DELETE CASCADE,
  participant_hash char(64) NOT NULL,
  interested boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (connection_id,participant_hash)
);
