-- Senha padrão 123 (hash bcrypt) - deve ser alterada no primeiro login
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT true;

-- Hash bcrypt de "123" - aplica a usuários sem senha definida
UPDATE users SET
  password_hash = '$2a$10$uTr26SWYWuGs.D/j0JJtf.ClwuNgzbE38JRdB76Xoyk41JKdNKkv2',
  must_change_password = true
WHERE password_hash IS NULL OR password_hash = '';

ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
ALTER TABLE users ALTER COLUMN must_change_password SET NOT NULL;
ALTER TABLE users ALTER COLUMN must_change_password SET DEFAULT true;
