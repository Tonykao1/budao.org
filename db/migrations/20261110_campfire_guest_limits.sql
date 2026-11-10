-- Ephemeral pseudonymous abuse limits for the global no-account Campfire service.
-- Do not store raw IP addresses, geolocation, phone numbers or device fingerprints.
CREATE TABLE IF NOT EXISTS campfire_write_limits (
  scope varchar(24) NOT NULL,
  key_hash char(64) NOT NULL,
  bucket_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1 CHECK (request_count > 0),
  PRIMARY KEY (scope,key_hash,bucket_start)
);
CREATE INDEX IF NOT EXISTS campfire_write_limits_expiry_idx
  ON campfire_write_limits(bucket_start);
