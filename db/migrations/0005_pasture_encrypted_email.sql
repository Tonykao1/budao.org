ALTER TABLE pasture_users ADD COLUMN IF NOT EXISTS email_ciphertext text;
ALTER TABLE pasture_users ADD COLUMN IF NOT EXISTS email_nonce text;
ALTER TABLE pasture_users ADD COLUMN IF NOT EXISTS email_tag text;
