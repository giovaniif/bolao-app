ALTER TABLE boloes ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id);
ALTER TABLE boloes ADD COLUMN IF NOT EXISTS visibility VARCHAR(10) NOT NULL DEFAULT 'private';
ALTER TABLE boloes ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE boloes ADD COLUMN IF NOT EXISTS invite_code VARCHAR(12);
ALTER TABLE boloes ADD COLUMN IF NOT EXISTS max_members INT NOT NULL DEFAULT 50;

CREATE UNIQUE INDEX IF NOT EXISTS idx_boloes_invite_code ON boloes (invite_code) WHERE invite_code IS NOT NULL;

ALTER TABLE bolao_participants ADD COLUMN IF NOT EXISTS role VARCHAR(12) NOT NULL DEFAULT 'participant';
ALTER TABLE bolao_participants ADD COLUMN IF NOT EXISTS status VARCHAR(10) NOT NULL DEFAULT 'active';

ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(254);
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_identities (
    provider VARCHAR(20) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (provider, subject)
);

CREATE TABLE IF NOT EXISTS bolao_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bolao_id UUID NOT NULL REFERENCES boloes(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL UNIQUE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ,
    max_uses INT,
    uses INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'boloes_visibility_check') THEN
        ALTER TABLE boloes ADD CONSTRAINT boloes_visibility_check CHECK (visibility IN ('private', 'public'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bolao_participants_role_check') THEN
        ALTER TABLE bolao_participants ADD CONSTRAINT bolao_participants_role_check CHECK (role IN ('owner', 'admin', 'participant'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bolao_participants_status_check') THEN
        ALTER TABLE bolao_participants ADD CONSTRAINT bolao_participants_status_check CHECK (status IN ('pending', 'active', 'removed'));
    END IF;
END $$;

DO $$
DECLARE
    first_admin UUID;
BEGIN
    SELECT id INTO first_admin FROM users WHERE is_admin ORDER BY created_at, id LIMIT 1;
    IF first_admin IS NULL THEN
        RETURN;
    END IF;

    UPDATE bolao_participants bp SET role = 'admin'
    FROM users u, boloes b
    WHERE bp.user_id = u.id AND bp.bolao_id = b.id
      AND u.is_admin AND b.owner_id IS NULL AND bp.role = 'participant';

    INSERT INTO bolao_participants (bolao_id, user_id, role)
    SELECT id, first_admin, 'owner' FROM boloes WHERE owner_id IS NULL
    ON CONFLICT (bolao_id, user_id) DO UPDATE SET role = 'owner';

    UPDATE boloes SET owner_id = first_admin WHERE owner_id IS NULL;
END $$;

UPDATE boloes SET invite_code = upper(substr(md5(random()::text || id::text), 1, 8))
WHERE invite_code IS NULL;
