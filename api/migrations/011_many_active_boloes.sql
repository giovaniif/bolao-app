DROP INDEX IF EXISTS idx_boloes_one_active;
CREATE INDEX IF NOT EXISTS idx_boloes_status_started ON boloes (status, started_at);
