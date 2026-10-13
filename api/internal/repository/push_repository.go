package repository

import (
	"context"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PushRepository struct {
	pool *pgxpool.Pool
}

func NewPushRepository(pool *pgxpool.Pool) *PushRepository {
	return &PushRepository{pool: pool}
}

func (r *PushRepository) Upsert(ctx context.Context, s *models.PushSubscription) error {
	query := `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (endpoint) DO UPDATE
		SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
		RETURNING id`
	return r.pool.QueryRow(ctx, query, uuid.New(), s.UserID, s.Endpoint, s.P256dh, s.Auth).Scan(&s.ID)
}

func (r *PushRepository) DeleteForUser(ctx context.Context, userID uuid.UUID, endpoint string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`, userID, endpoint)
	return err
}

func (r *PushRepository) DeleteByEndpoint(ctx context.Context, endpoint string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM push_subscriptions WHERE endpoint = $1`, endpoint)
	return err
}

func (r *PushRepository) ListForBolao(ctx context.Context, bolaoID uuid.UUID) ([]models.PushSubscription, error) {
	query := `SELECT s.id, s.user_id, s.endpoint, s.p256dh, s.auth
		FROM push_subscriptions s
		JOIN bolao_participants p ON p.user_id = s.user_id AND p.bolao_id = $1`
	rows, err := r.pool.Query(ctx, query, bolaoID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []models.PushSubscription
	for rows.Next() {
		var s models.PushSubscription
		if err := rows.Scan(&s.ID, &s.UserID, &s.Endpoint, &s.P256dh, &s.Auth); err != nil {
			return nil, err
		}
		subs = append(subs, s)
	}
	return subs, rows.Err()
}

func (r *PushRepository) ClaimNotification(ctx context.Context, bolaoID uuid.UUID, round int, kind string, closesAt time.Time) (bool, error) {
	tag, err := r.pool.Exec(ctx, `INSERT INTO notification_log (bolao_id, round, kind, closes_at)
		VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, bolaoID, round, kind, closesAt)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}
