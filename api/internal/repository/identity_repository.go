package repository

import (
	"context"
	"errors"
	"strings"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrIdentityNotFound = errors.New("identidade não encontrada")

type IdentityRepository struct {
	*UserRepository
	pool *pgxpool.Pool
}

func NewIdentityRepository(pool *pgxpool.Pool) *IdentityRepository {
	return &IdentityRepository{UserRepository: NewUserRepository(pool), pool: pool}
}

func (r *IdentityRepository) UserIDByIdentity(ctx context.Context, provider, subject string) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.pool.QueryRow(ctx, `SELECT user_id FROM user_identities WHERE provider = $1 AND subject = $2`, provider, subject).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrIdentityNotFound
	}
	return id, err
}

func (r *IdentityRepository) UserIDByEmail(ctx context.Context, email string) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.pool.QueryRow(ctx, `SELECT id FROM users WHERE email IS NOT NULL AND lower(email) = lower(trim($1))`, email).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrIdentityNotFound
	}
	return id, err
}

func (r *IdentityRepository) LinkIdentity(ctx context.Context, userID uuid.UUID, provider, subject, email string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO user_identities (provider, subject, user_id, email)
		VALUES ($1, $2, $3, NULLIF(lower(trim($4)), ''))
		ON CONFLICT (provider, subject) DO NOTHING`, provider, subject, userID, email)
	return err
}

func (r *IdentityRepository) CreateSocialAccount(ctx context.Context, username, email, provider, subject string) (*models.User, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	u := models.User{ID: uuid.New(), Username: username, DisplayName: username}
	err = tx.QueryRow(ctx, `
		INSERT INTO users (id, username, display_name, email, must_change_password)
		VALUES ($1, $2, $2, NULLIF(lower(trim($3)), ''), false)
		RETURNING created_at, updated_at`, u.ID, username, email).Scan(&u.CreatedAt, &u.UpdatedAt)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		if strings.Contains(pgErr.ConstraintName, "email") {
			return nil, ErrEmailTaken
		}
		return nil, ErrUsernameTaken
	}
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO user_identities (provider, subject, user_id, email)
		VALUES ($1, $2, $3, NULLIF(lower(trim($4)), ''))`, provider, subject, u.ID, email); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &u, nil
}
