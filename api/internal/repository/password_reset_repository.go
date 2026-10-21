package repository

import (
	"context"
	"strings"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PasswordResetRepository struct {
	pool *pgxpool.Pool
}

func NewPasswordResetRepository(pool *pgxpool.Pool) *PasswordResetRepository {
	return &PasswordResetRepository{pool: pool}
}

func (r *PasswordResetRepository) FindByLogin(ctx context.Context, login string) (*models.User, error) {
	var u models.User
	query := `SELECT id, username, display_name, email FROM users
		WHERE username = $1 OR (email IS NOT NULL AND lower(email) = lower($1))
		ORDER BY (username = $1) DESC LIMIT 1`
	err := r.pool.QueryRow(ctx, query, strings.TrimSpace(login)).Scan(&u.ID, &u.Username, &u.DisplayName, &u.Email)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *PasswordResetRepository) LatestResetTokenAt(ctx context.Context, userID uuid.UUID) (*time.Time, error) {
	var latest *time.Time
	err := r.pool.QueryRow(ctx, `SELECT max(created_at) FROM password_reset_tokens WHERE user_id = $1`, userID).Scan(&latest)
	return latest, err
}

func (r *PasswordResetRepository) CreateResetToken(ctx context.Context, userID uuid.UUID, tokenHash string, createdAt, expiresAt time.Time) error {
	_, err := r.pool.Exec(ctx, `INSERT INTO password_reset_tokens (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)`,
		tokenHash, userID, createdAt, expiresAt)
	return err
}

func (r *PasswordResetRepository) ResetPassword(ctx context.Context, tokenHash string, now time.Time, passwordHash string) (bool, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var userID uuid.UUID
	err = tx.QueryRow(ctx, `UPDATE password_reset_tokens SET used_at = $2
		WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2
		RETURNING user_id`, tokenHash, now).Scan(&userID)
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if _, err := tx.Exec(ctx, `UPDATE users SET password_hash = $2, must_change_password = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, userID, passwordHash); err != nil {
		return false, err
	}
	if _, err := tx.Exec(ctx, `UPDATE password_reset_tokens SET used_at = $2 WHERE user_id = $1 AND used_at IS NULL`, userID, now); err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
}
