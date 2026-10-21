CREATE TABLE IF NOT EXISTS expo_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    platform VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expo_push_tokens_user ON expo_push_tokens (user_id);

CREATE TABLE IF NOT EXISTS user_notification_log (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope_id UUID NOT NULL,
    round INT NOT NULL,
    kind VARCHAR(20) NOT NULL,
    closes_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, scope_id, round, kind, closes_at)
);
