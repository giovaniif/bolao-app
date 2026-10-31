package repository

import (
	"context"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type MembershipRepository struct {
	pool *pgxpool.Pool
}

func NewMembershipRepository(pool *pgxpool.Pool) *MembershipRepository {
	return &MembershipRepository{pool: pool}
}

func (r *MembershipRepository) Get(ctx context.Context, bolaoID, userID uuid.UUID) (*models.Membership, error) {
	var m models.Membership
	query := `SELECT bolao_id, user_id, role, status, amount_paid, joined_at
		FROM bolao_participants WHERE bolao_id = $1 AND user_id = $2`
	err := r.pool.QueryRow(ctx, query, bolaoID, userID).Scan(&m.BolaoID, &m.UserID, &m.Role, &m.Status, &m.AmountPaid, &m.JoinedAt)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *MembershipRepository) Add(ctx context.Context, bolaoID, userID uuid.UUID, role, status string) error {
	query := `INSERT INTO bolao_participants (bolao_id, user_id, role, status)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (bolao_id, user_id) DO UPDATE SET role = $3, status = $4, joined_at = CURRENT_TIMESTAMP`
	_, err := r.pool.Exec(ctx, query, bolaoID, userID, role, status)
	return err
}

func (r *MembershipRepository) SetStatus(ctx context.Context, bolaoID, userID uuid.UUID, status string) error {
	query := `UPDATE bolao_participants SET status = $3 WHERE bolao_id = $1 AND user_id = $2`
	_, err := r.pool.Exec(ctx, query, bolaoID, userID, status)
	return err
}

func (r *MembershipRepository) SetRole(ctx context.Context, bolaoID, userID uuid.UUID, role string) error {
	query := `UPDATE bolao_participants SET role = $3 WHERE bolao_id = $1 AND user_id = $2`
	_, err := r.pool.Exec(ctx, query, bolaoID, userID, role)
	return err
}

func (r *MembershipRepository) CountActive(ctx context.Context, bolaoID uuid.UUID) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM bolao_participants WHERE bolao_id = $1 AND status = 'active'`, bolaoID).Scan(&count)
	return count, err
}

func (r *MembershipRepository) ListByBolao(ctx context.Context, bolaoID uuid.UUID) ([]models.MemberView, error) {
	query := `SELECT u.id, u.username, u.display_name, u.favorite_team, bp.role, bp.status, bp.amount_paid, bp.joined_at
		FROM bolao_participants bp
		JOIN users u ON u.id = bp.user_id
		WHERE bp.bolao_id = $1 AND bp.status <> 'removed'
		ORDER BY bp.status DESC, u.display_name`
	rows, err := r.pool.Query(ctx, query, bolaoID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var members []models.MemberView
	for rows.Next() {
		var m models.MemberView
		if err := rows.Scan(&m.ID, &m.Username, &m.DisplayName, &m.FavoriteTeam, &m.Role, &m.Status, &m.AmountPaid, &m.JoinedAt); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	return members, rows.Err()
}

func (r *MembershipRepository) ListBoloesOfUser(ctx context.Context, userID uuid.UUID) ([]models.MyBolao, error) {
	query := `SELECT b.id, b.name, b.status, b.visibility, b.requires_approval, b.started_at, b.finished_at, b.created_at, b.updated_at, bp.role, bp.status,
			(SELECT COUNT(*) FROM bolao_participants a WHERE a.bolao_id = b.id AND a.status = 'active')
		FROM bolao_participants bp
		JOIN boloes b ON b.id = bp.bolao_id
		WHERE bp.user_id = $1 AND bp.status <> 'removed'
		ORDER BY b.status, b.started_at DESC`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var boloes []models.MyBolao
	for rows.Next() {
		var b models.MyBolao
		if err := rows.Scan(&b.ID, &b.Name, &b.Status, &b.Visibility, &b.RequiresApproval, &b.StartedAt, &b.FinishedAt, &b.CreatedAt, &b.UpdatedAt, &b.Role, &b.MemberStatus, &b.MemberCount); err != nil {
			return nil, err
		}
		boloes = append(boloes, b)
	}
	return boloes, rows.Err()
}

func (r *MembershipRepository) TransferOwnership(ctx context.Context, bolaoID, from, to uuid.UUID) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `UPDATE bolao_participants SET role = 'admin' WHERE bolao_id = $1 AND user_id = $2`, bolaoID, from); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE bolao_participants SET role = 'owner' WHERE bolao_id = $1 AND user_id = $2`, bolaoID, to); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE boloes SET owner_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, bolaoID, to); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
