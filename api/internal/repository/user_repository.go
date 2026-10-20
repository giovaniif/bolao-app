package repository

import (
	"context"
	"errors"
	"strings"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
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
		INSERT INTO users (id, username, display_name, favorite_team, is_admin, password_hash, must_change_password)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING created_at, updated_at`
	return r.pool.QueryRow(ctx, query,
		user.ID, user.Username, user.DisplayName, user.FavoriteTeam, user.IsAdmin, user.PasswordHash, user.MustChangePassword,
	).Scan(&user.CreatedAt, &user.UpdatedAt)
}

func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	var u models.User
	query := `SELECT id, username, display_name, favorite_team, is_admin, COALESCE(password_hash, ''), must_change_password, created_at, updated_at
		FROM users WHERE id = $1`
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&u.ID, &u.Username, &u.DisplayName, &u.FavoriteTeam, &u.IsAdmin, &u.PasswordHash, &u.MustChangePassword, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *UserRepository) GetByUsername(ctx context.Context, username string) (*models.User, error) {
	var u models.User
	query := `SELECT id, username, display_name, favorite_team, is_admin, COALESCE(password_hash, ''), must_change_password, created_at, updated_at
		FROM users WHERE username = $1`
	err := r.pool.QueryRow(ctx, query, username).Scan(
		&u.ID, &u.Username, &u.DisplayName, &u.FavoriteTeam, &u.IsAdmin, &u.PasswordHash, &u.MustChangePassword, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *UserRepository) List(ctx context.Context) ([]models.User, error) {
	query := `SELECT id, username, display_name, favorite_team, is_admin, created_at, updated_at
		FROM users ORDER BY display_name`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Username, &u.DisplayName, &u.FavoriteTeam, &u.IsAdmin, &u.CreatedAt, &u.UpdatedAt); err != nil {
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
		UPDATE users SET username = $2, display_name = $3, favorite_team = $4, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1 RETURNING updated_at`
	return r.pool.QueryRow(ctx, query, user.ID, user.Username, user.DisplayName, user.FavoriteTeam).Scan(&user.UpdatedAt)
}

func (r *UserRepository) GetByUsernameExcluding(ctx context.Context, username string, excludeID uuid.UUID) (*models.User, error) {
	var u models.User
	query := `SELECT id, username, display_name, favorite_team, is_admin, COALESCE(password_hash, ''), must_change_password, created_at, updated_at
		FROM users WHERE username = $1 AND id != $2`
	err := r.pool.QueryRow(ctx, query, username, excludeID).Scan(
		&u.ID, &u.Username, &u.DisplayName, &u.FavoriteTeam, &u.IsAdmin, &u.PasswordHash, &u.MustChangePassword, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

var (
	ErrUsernameTaken = errors.New("este nome de usuário já está em uso")
	ErrEmailTaken    = errors.New("este e-mail já está em uso")
)

func (r *UserRepository) CreateAccount(ctx context.Context, username, displayName, email, passwordHash string) (*models.User, error) {
	u := models.User{ID: uuid.New(), Username: username, DisplayName: displayName, PasswordHash: passwordHash}
	query := `INSERT INTO users (id, username, display_name, email, password_hash, must_change_password)
		VALUES ($1, $2, $3, lower(trim($4)), $5, false)
		RETURNING created_at, updated_at`
	err := r.pool.QueryRow(ctx, query, u.ID, username, displayName, email, passwordHash).Scan(&u.CreatedAt, &u.UpdatedAt)
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
	return &u, nil
}

func (r *UserRepository) ListSharingBolaoWith(ctx context.Context, userID uuid.UUID) ([]models.User, error) {
	query := `SELECT DISTINCT u.id, u.username, u.display_name, u.favorite_team, u.is_admin, u.created_at, u.updated_at
		FROM users u
		JOIN bolao_participants theirs ON theirs.user_id = u.id AND theirs.status = 'active'
		JOIN bolao_participants mine ON mine.bolao_id = theirs.bolao_id AND mine.user_id = $1 AND mine.status = 'active'
		JOIN boloes b ON b.id = theirs.bolao_id AND b.status = 'active'
		ORDER BY u.display_name`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []models.User
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Username, &u.DisplayName, &u.FavoriteTeam, &u.IsAdmin, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

var ErrOwnsActiveBolao = errors.New("passe seus bolões ativos para outra pessoa antes de excluir a conta")

func (r *UserRepository) DeleteAccount(ctx context.Context, userID uuid.UUID) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var ownsWithMembers bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM boloes b
			WHERE b.owner_id = $1 AND b.status = 'active'
			  AND EXISTS (SELECT 1 FROM bolao_participants p WHERE p.bolao_id = b.id AND p.user_id <> $1 AND p.status = 'active')
		)`, userID).Scan(&ownsWithMembers); err != nil {
		return err
	}
	if ownsWithMembers {
		return ErrOwnsActiveBolao
	}
	statements := []string{
		`UPDATE boloes SET status = 'finished', finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE owner_id = $1 AND status = 'active'`,
		`UPDATE bolao_participants SET status = 'removed' WHERE user_id = $1`,
		`DELETE FROM user_identities WHERE user_id = $1`,
		`DELETE FROM push_subscriptions WHERE user_id = $1`,
		`UPDATE users SET username = 'excluido_' || substr(replace(id::text, '-', ''), 1, 12), display_name = 'Conta excluída',
			email = NULL, password_hash = NULL, favorite_team = NULL, is_admin = false, must_change_password = false,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`,
	}
	for _, statement := range statements {
		if _, err := tx.Exec(ctx, statement, userID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
