CREATE TABLE IF NOT EXISTS competitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(30) NOT NULL,
    provider_code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    season INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT competitions_status_check CHECK (status IN ('active', 'finished')),
    UNIQUE (provider, provider_code, season)
);

INSERT INTO competitions (provider, provider_code, name, season)
VALUES ('football-data', 'BSA', 'Brasileirão Série A 2026', 2026)
ON CONFLICT (provider, provider_code, season) DO NOTHING;

ALTER TABLE boloes ADD COLUMN IF NOT EXISTS competition_id UUID REFERENCES competitions(id);

ALTER TABLE matches ADD COLUMN IF NOT EXISTS competition_id UUID REFERENCES competitions(id);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS provider_match_id BIGINT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS kickoff_at TIMESTAMPTZ;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'scheduled';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_competition_provider ON matches (competition_id, provider_match_id) WHERE provider_match_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_matches_competition_round ON matches (competition_id, round);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matches_status_check') THEN
        ALTER TABLE matches ADD CONSTRAINT matches_status_check
            CHECK (status IN ('scheduled', 'timed', 'live', 'finished', 'postponed', 'cancelled'));
    END IF;
END $$;

UPDATE boloes SET competition_id = (
    SELECT id FROM competitions WHERE provider = 'football-data' AND provider_code = 'BSA' AND season = 2026
)
WHERE status = 'active' AND competition_id IS NULL;

UPDATE matches m SET competition_id = b.competition_id
FROM boloes b
WHERE m.bolao_id = b.id AND m.competition_id IS NULL AND b.competition_id IS NOT NULL;
