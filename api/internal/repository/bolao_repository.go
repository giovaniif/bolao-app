package repository

import (
	"context"
	"errors"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrActiveBolaoExists is returned by Create when a bolão is already active
// (backstop for the app-level check, races against the unique partial index).
var ErrActiveBolaoExists = errors.New("já existe um bolão ativo")

type BolaoRepository struct {
	pool *pgxpool.Pool
}

func NewBolaoRepository(pool *pgxpool.Pool) *BolaoRepository {
	return &BolaoRepository{pool: pool}
}

func (r *BolaoRepository) Create(ctx context.Context, name string) (*models.Bolao, error) {
	var b models.Bolao
	query := `INSERT INTO boloes (id, name) VALUES ($1, $2)
		RETURNING id, name, status, started_at, finished_at, created_at, updated_at`
	err := r.pool.QueryRow(ctx, query, uuid.New(), name).Scan(
		&b.ID, &b.Name, &b.Status, &b.StartedAt, &b.FinishedAt, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, ErrActiveBolaoExists
		}
		return nil, err
	}
	return &b, nil
}

func (r *BolaoRepository) GetActive(ctx context.Context) (*models.Bolao, error) {
	var b models.Bolao
	query := `SELECT id, name, status, started_at, finished_at, created_at, updated_at
		FROM boloes WHERE status = 'active' LIMIT 1`
	err := r.pool.QueryRow(ctx, query).Scan(
		&b.ID, &b.Name, &b.Status, &b.StartedAt, &b.FinishedAt, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (r *BolaoRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Bolao, error) {
	var b models.Bolao
	query := `SELECT id, name, status, started_at, finished_at, created_at, updated_at
		FROM boloes WHERE id = $1`
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&b.ID, &b.Name, &b.Status, &b.StartedAt, &b.FinishedAt, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (r *BolaoRepository) List(ctx context.Context) ([]models.Bolao, error) {
	query := `SELECT id, name, status, started_at, finished_at, created_at, updated_at
		FROM boloes ORDER BY started_at DESC`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var boloes []models.Bolao
	for rows.Next() {
		var b models.Bolao
		if err := rows.Scan(&b.ID, &b.Name, &b.Status, &b.StartedAt, &b.FinishedAt, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, err
		}
		boloes = append(boloes, b)
	}
	return boloes, rows.Err()
}

func (r *BolaoRepository) Finish(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE boloes SET status = 'finished', finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND status = 'active'`
	tag, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// EnrollAllUsers adds every existing user as a participant of bolaoID (amount_paid defaults to 0).
func (r *BolaoRepository) EnrollAllUsers(ctx context.Context, bolaoID uuid.UUID) error {
	query := `INSERT INTO bolao_participants (bolao_id, user_id)
		SELECT $1, id FROM users
		ON CONFLICT (bolao_id, user_id) DO NOTHING`
	_, err := r.pool.Exec(ctx, query, bolaoID)
	return err
}

// AddParticipant enrolls a single user in bolaoID (used when a new user is created mid-season).
func (r *BolaoRepository) AddParticipant(ctx context.Context, bolaoID, userID uuid.UUID) error {
	query := `INSERT INTO bolao_participants (bolao_id, user_id)
		VALUES ($1, $2)
		ON CONFLICT (bolao_id, user_id) DO NOTHING`
	_, err := r.pool.Exec(ctx, query, bolaoID, userID)
	return err
}

func (r *BolaoRepository) ListParticipants(ctx context.Context, bolaoID uuid.UUID) ([]models.ParticipantView, error) {
	query := `SELECT u.id, u.username, u.display_name, u.favorite_team, u.is_admin, u.must_change_password, u.created_at, u.updated_at,
			bp.amount_paid, bp.joined_at
		FROM bolao_participants bp
		JOIN users u ON u.id = bp.user_id
		WHERE bp.bolao_id = $1
		ORDER BY u.display_name`
	rows, err := r.pool.Query(ctx, query, bolaoID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var participants []models.ParticipantView
	for rows.Next() {
		var p models.ParticipantView
		if err := rows.Scan(
			&p.ID, &p.Username, &p.DisplayName, &p.FavoriteTeam, &p.IsAdmin, &p.MustChangePassword, &p.CreatedAt, &p.UpdatedAt,
			&p.AmountPaid, &p.JoinedAt,
		); err != nil {
			return nil, err
		}
		participants = append(participants, p)
	}
	return participants, rows.Err()
}

func (r *BolaoRepository) UpdateParticipantAmountPaid(ctx context.Context, bolaoID, userID uuid.UUID, amount float64) error {
	query := `INSERT INTO bolao_participants (bolao_id, user_id, amount_paid)
		VALUES ($1, $2, $3)
		ON CONFLICT (bolao_id, user_id) DO UPDATE SET amount_paid = $3`
	_, err := r.pool.Exec(ctx, query, bolaoID, userID, amount)
	return err
}
