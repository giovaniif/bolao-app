ALTER TABLE user_identities ADD COLUMN IF NOT EXISTS email VARCHAR(254);

CREATE INDEX IF NOT EXISTS idx_user_identities_user ON user_identities (user_id);
