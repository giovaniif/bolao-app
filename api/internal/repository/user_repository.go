package repository

import (
	"context"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserRepository struct {
	pool *pgxpool.Pool
}

func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

func (r *UserRepository) Create(ctx context.Context, user *models.User) error {
	query := `
		INSERT INTO users (id, username, display_name, favorite_team, is_admin, amount_paid, password_hash, must_change_password)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING created_at, updated_at`
	return r.pool.QueryRow(ctx, query,
		user.ID, user.Username, user.DisplayName, user.FavoriteTeam, user.IsAdmin, user.AmountPaid, user.PasswordHash, user.MustChangePassword,
	).Scan(&user.CreatedAt, &user.UpdatedAt)
}

func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	var u models.User
	query := `SELECT id, username, display_name, favorite_team, is_admin, amount_paid, password_hash, must_change_password, created_at, updated_at
		FROM users WHERE id = $1`
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&u.ID, &u.Username, &u.DisplayName, &u.FavoriteTeam, &u.IsAdmin, &u.AmountPaid, &u.PasswordHash, &u.MustChangePassword, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *UserRepository) GetByUsername(ctx context.Context, username string) (*models.User, error) {
	var u models.User
	query := `SELECT id, username, display_name, favorite_team, is_admin, amount_paid, password_hash, must_change_password, created_at, updated_at
		FROM users WHERE username = $1`
	err := r.pool.QueryRow(ctx, query, username).Scan(
		&u.ID, &u.Username, &u.DisplayName, &u.FavoriteTeam, &u.IsAdmin, &u.AmountPaid, &u.PasswordHash, &u.MustChangePassword, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *UserRepository) List(ctx context.Context) ([]models.User, error) {
	query := `SELECT id, username, display_name, favorite_team, is_admin, amount_paid, created_at, updated_at
		FROM users ORDER BY display_name`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Username, &u.DisplayName, &u.FavoriteTeam, &u.IsAdmin, &u.AmountPaid, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (r *UserRepository) UpdatePassword(ctx context.Context, userID uuid.UUID, passwordHash string) error {
	query := `UPDATE users SET password_hash = $2, must_change_password = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, userID, passwordHash)
	return err
}

func (r *UserRepository) Update(ctx context.Context, user *models.User) error {
	query := `
		UPDATE users SET username = $2, display_name = $3, favorite_team = $4, amount_paid = $5, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1 RETURNING updated_at`
	return r.pool.QueryRow(ctx, query, user.ID, user.Username, user.DisplayName, user.FavoriteTeam, user.AmountPaid).Scan(&user.UpdatedAt)
}

func (r *UserRepository) GetByUsernameExcluding(ctx context.Context, username string, excludeID uuid.UUID) (*models.User, error) {
	var u models.User
	query := `SELECT id, username, display_name, favorite_team, is_admin, amount_paid, password_hash, must_change_password, created_at, updated_at
		FROM users WHERE username = $1 AND id != $2`
	err := r.pool.QueryRow(ctx, query, username, excludeID).Scan(
		&u.ID, &u.Username, &u.DisplayName, &u.FavoriteTeam, &u.IsAdmin, &u.AmountPaid, &u.PasswordHash, &u.MustChangePassword, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}
