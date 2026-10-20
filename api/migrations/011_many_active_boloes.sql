DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
        WHERE c.relname = 'idx_boloes_one_active' AND i.indisunique
    ) THEN
        DROP INDEX idx_boloes_one_active;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_boloes_one_active ON boloes (status);
CREATE INDEX IF NOT EXISTS idx_boloes_status_started ON boloes (status, started_at);
