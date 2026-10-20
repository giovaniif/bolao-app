ALTER TABLE competitions ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS sync_failures INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS provider_calls (
    day DATE NOT NULL,
    provider VARCHAR(30) NOT NULL,
    calls INT NOT NULL DEFAULT 0,
    PRIMARY KEY (day, provider)
);
