package repository

import (
	"context"
	"crypto/rand"
	"errors"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrActiveBolaoExists = errors.New("já existe um bolão ativo")

type BolaoRepository struct {
	pool *pgxpool.Pool
}

func NewBolaoRepository(pool *pgxpool.Pool) *BolaoRepository {
	return &BolaoRepository{pool: pool}
}

func (r *BolaoRepository) Create(ctx context.Context, name string) (*models.Bolao, error) {
	var b models.Bolao
	query := `INSERT INTO boloes AS b (id, name, invite_code) VALUES ($1, $2, $3)
		RETURNING ` + bolaoColumns
	err := r.pool.QueryRow(ctx, query, uuid.New(), name, NewInviteCode()).Scan(bolaoFields(&b)...)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, ErrActiveBolaoExists
		}
		return nil, err
	}
	return &b, nil
}

const bolaoColumns = "b.id, b.name, b.status, b.owner_id, b.visibility, b.requires_approval, b.max_members, COALESCE(b.invite_code, ''), b.started_at, b.finished_at, b.created_at, b.updated_at"

func bolaoFields(b *models.Bolao) []any {
	return []any{&b.ID, &b.Name, &b.Status, &b.OwnerID, &b.Visibility, &b.RequiresApproval, &b.MaxMembers, &b.InviteCode, &b.StartedAt, &b.FinishedAt, &b.CreatedAt, &b.UpdatedAt}
}

const inviteAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

func NewInviteCode() string {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		panic(err)
	}
	for i, v := range buf {
		buf[i] = inviteAlphabet[int(v)%len(inviteAlphabet)]
	}
	return string(buf)
}

func (r *BolaoRepository) CreateOwned(ctx context.Context, name string, ownerID uuid.UUID) (*models.Bolao, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var b models.Bolao
	query := `INSERT INTO boloes AS b (id, name, owner_id, invite_code) VALUES ($1, $2, $3, $4)
		RETURNING ` + bolaoColumns
	if err := tx.QueryRow(ctx, query, uuid.New(), name, ownerID, NewInviteCode()).Scan(bolaoFields(&b)...); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO bolao_participants (bolao_id, user_id, role, status) VALUES ($1, $2, 'owner', 'active')`, b.ID, ownerID); err != nil {
		return nil, err
	}
	return &b, tx.Commit(ctx)
}

func (r *BolaoRepository) UpdateSettings(ctx context.Context, id uuid.UUID, name, visibility string, requiresApproval bool) error {
	query := `UPDATE boloes SET name = $2, visibility = $3, requires_approval = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id, name, visibility, requiresApproval)
	return err
}

func (r *BolaoRepository) GetActive(ctx context.Context) (*models.Bolao, error) {
	var b models.Bolao
	query := `SELECT ` + bolaoColumns + `
		FROM boloes b WHERE b.status = 'active'
			AND (b.owner_id IS NULL OR EXISTS (SELECT 1 FROM users u WHERE u.id = b.owner_id AND u.is_admin))
		ORDER BY b.started_at, b.created_at LIMIT 1`
	err := r.pool.QueryRow(ctx, query).Scan(bolaoFields(&b)...)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (r *BolaoRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Bolao, error) {
	var b models.Bolao
	query := `SELECT ` + bolaoColumns + `
		FROM boloes b WHERE b.id = $1`
	err := r.pool.QueryRow(ctx, query, id).Scan(bolaoFields(&b)...)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (r *BolaoRepository) List(ctx context.Context) ([]models.Bolao, error) {
	query := `SELECT ` + bolaoColumns + `
		FROM boloes b ORDER BY b.started_at DESC`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var boloes []models.Bolao
	for rows.Next() {
		var b models.Bolao
		if err := rows.Scan(bolaoFields(&b)...); err != nil {
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

func (r *BolaoRepository) EnrollAllUsers(ctx context.Context, bolaoID uuid.UUID) error {
	query := `INSERT INTO bolao_participants (bolao_id, user_id)
		SELECT $1, id FROM users
		ON CONFLICT (bolao_id, user_id) DO NOTHING`
	_, err := r.pool.Exec(ctx, query, bolaoID)
	return err
}

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
		WHERE bp.bolao_id = $1 AND bp.status = 'active'
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

func (r *BolaoRepository) SetHidden(ctx context.Context, id uuid.UUID, hidden bool) error {
	_, err := r.pool.Exec(ctx, `UPDATE boloes SET hidden = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, id, hidden)
	return err
}

func (r *BolaoRepository) CountOwnedActive(ctx context.Context, ownerID uuid.UUID) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM boloes WHERE owner_id = $1 AND status = 'active'`, ownerID).Scan(&count)
	return count, err
}

func (r *BolaoRepository) ListPublic(ctx context.Context, search string, limit int) ([]models.PublicBolao, error) {
	query := `SELECT b.id, b.name, b.requires_approval, b.max_members,
			(SELECT COUNT(*) FROM bolao_participants p WHERE p.bolao_id = b.id AND p.status = 'active') AS members
		FROM boloes b
		WHERE b.visibility = 'public' AND b.status = 'active' AND NOT b.hidden
			AND ($1 = '' OR b.name ILIKE '%' || $1 || '%')
		ORDER BY members DESC, b.created_at DESC
		LIMIT $2`
	rows, err := r.pool.Query(ctx, query, search, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	boloes := []models.PublicBolao{}
	for rows.Next() {
		var b models.PublicBolao
		if err := rows.Scan(&b.ID, &b.Name, &b.RequiresApproval, &b.MaxMembers, &b.MemberCount); err != nil {
			return nil, err
		}
		boloes = append(boloes, b)
	}
	return boloes, rows.Err()
}
