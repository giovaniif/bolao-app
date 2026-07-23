-- Boloes: um bolão por temporada (ex.: Brasileirão 2026). O bolão ativo é onde
-- todas as escritas (jogos, palpites, resultados) acontecem; bolões finalizados
-- ficam somente leitura para sempre, permitindo consultar o histórico.
CREATE TABLE IF NOT EXISTS boloes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT boloes_status_check CHECK (status IN ('active', 'finished'))
);

-- Backstop no nível do banco: no máximo um bolão ativo por vez.
CREATE UNIQUE INDEX IF NOT EXISTS idx_boloes_one_active ON boloes (status) WHERE status = 'active';

-- Bootstrap: envolve todos os dados pré-existentes em um bolão "atual", uma única vez.
-- Depois da primeira execução bem-sucedida a tabela nunca mais fica vazia, então isso não roda de novo.
INSERT INTO boloes (name, status, started_at)
SELECT 'Brasileirão 2026', 'active', COALESCE((SELECT MIN(created_at) FROM matches), CURRENT_TIMESTAMP)
WHERE NOT EXISTS (SELECT 1 FROM boloes);

-- matches.bolao_id
ALTER TABLE matches ADD COLUMN IF NOT EXISTS bolao_id UUID REFERENCES boloes(id);

UPDATE matches SET bolao_id = (SELECT id FROM boloes ORDER BY created_at LIMIT 1)
WHERE bolao_id IS NULL;

ALTER TABLE matches ALTER COLUMN bolao_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matches_bolao_round ON matches (bolao_id, round);

-- Participação / pagamento por bolão.
CREATE TABLE IF NOT EXISTS bolao_participants (
    bolao_id UUID NOT NULL REFERENCES boloes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (bolao_id, user_id)
);

-- Migra users.amount_paid para bolao_participants e remove a coluna.
-- Guardado por information_schema para ser inofensivo em execuções futuras,
-- já que runMigrations roda o arquivo inteiro de novo em todo boot do servidor
-- e a coluna não vai mais existir depois da primeira execução bem-sucedida.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'amount_paid'
    ) THEN
        INSERT INTO bolao_participants (bolao_id, user_id, amount_paid)
        SELECT b.id, u.id, u.amount_paid
        FROM users u
        CROSS JOIN (SELECT id FROM boloes ORDER BY created_at LIMIT 1) b
        ON CONFLICT (bolao_id, user_id) DO NOTHING;

        ALTER TABLE users DROP COLUMN amount_paid;
    END IF;
END $$;
