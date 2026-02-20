-- Parciais: placar não preenchido = NULL (não 0×0). Só contabiliza quando for preenchido (incluindo 0×0 explícito).
ALTER TABLE match_partials
  ALTER COLUMN home_goals DROP NOT NULL,
  ALTER COLUMN home_goals DROP DEFAULT,
  ALTER COLUMN away_goals DROP NOT NULL,
  ALTER COLUMN away_goals DROP DEFAULT;
