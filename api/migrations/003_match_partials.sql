CREATE TABLE IF NOT EXISTS match_partials (
    match_id UUID PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
    home_goals INT NOT NULL DEFAULT 0,
    away_goals INT NOT NULL DEFAULT 0,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
