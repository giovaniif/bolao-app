package repository

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"strings"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrInviteUnavailable = errors.New("este convite expirou ou já foi usado")

type InviteRepository struct {
	pool *pgxpool.Pool
}

func NewInviteRepository(pool *pgxpool.Pool) *InviteRepository {
	return &InviteRepository{pool: pool}
}

func (r *InviteRepository) FindByCode(ctx context.Context, code string) (*models.Bolao, error) {
	var b models.Bolao
	query := `SELECT ` + bolaoColumns + ` FROM boloes b WHERE b.invite_code = $1`
	if err := r.pool.QueryRow(ctx, query, strings.ToUpper(strings.TrimSpace(code))).Scan(bolaoFields(&b)...); err != nil {
		return nil, err
	}
	return &b, nil
}

func (r *InviteRepository) RotateCode(ctx context.Context, bolaoID uuid.UUID) (string, error) {
	code := NewInviteCode()
	_, err := r.pool.Exec(ctx, `UPDATE boloes SET invite_code = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, bolaoID, code)
	return code, err
}

func (r *InviteRepository) CreateLink(ctx context.Context, bolaoID, createdBy uuid.UUID, expiresAt time.Time, maxUses *int) (string, error) {
	buf := make([]byte, 18)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(buf)
	_, err := r.pool.Exec(ctx, `INSERT INTO bolao_invites (bolao_id, token, created_by, expires_at, max_uses) VALUES ($1, $2, $3, $4, $5)`,
		bolaoID, token, createdBy, expiresAt, maxUses)
	return token, err
}

func (r *InviteRepository) FindLink(ctx context.Context, token string) (uuid.UUID, error) {
	var bolaoID uuid.UUID
	err := r.pool.QueryRow(ctx, `SELECT bolao_id FROM bolao_invites WHERE token = $1`, token).Scan(&bolaoID)
	return bolaoID, err
}

func (r *InviteRepository) UseLink(ctx context.Context, token string, now time.Time) (uuid.UUID, error) {
	var bolaoID uuid.UUID
	err := r.pool.QueryRow(ctx, `
		UPDATE bolao_invites SET uses = uses + 1
		WHERE token = $1 AND (expires_at IS NULL OR expires_at > $2) AND (max_uses IS NULL OR uses < max_uses)
		RETURNING bolao_id`, token, now).Scan(&bolaoID)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.UUID{}, ErrInviteUnavailable
	}
	return bolaoID, err
}
