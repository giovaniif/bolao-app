package repository

import (
	"context"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PartialRepository struct {
	pool *pgxpool.Pool
}

func NewPartialRepository(pool *pgxpool.Pool) *PartialRepository {
	return &PartialRepository{pool: pool}
}

func (r *PartialRepository) Upsert(ctx context.Context, matchID uuid.UUID, homeGoals, awayGoals int, updatedBy *uuid.UUID) error {
	query := `
		INSERT INTO match_partials (match_id, home_goals, away_goals, updated_by, updated_at)
		VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
		ON CONFLICT (match_id) DO UPDATE SET
			home_goals = $2, away_goals = $3, updated_by = $4, updated_at = CURRENT_TIMESTAMP`
	_, err := r.pool.Exec(ctx, query, matchID, homeGoals, awayGoals, updatedBy)
	return err
}

func (r *PartialRepository) GetByMatch(ctx context.Context, matchID uuid.UUID) (*models.MatchPartial, error) {
	var p models.MatchPartial
	query := `SELECT match_id, home_goals, away_goals, updated_by, updated_at
		FROM match_partials WHERE match_id = $1`
	err := r.pool.QueryRow(ctx, query, matchID).Scan(
		&p.MatchID, &p.HomeGoals, &p.AwayGoals, &p.UpdatedBy, &p.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *PartialRepository) ListByRound(ctx context.Context, round int) (map[uuid.UUID]models.MatchPartial, error) {
	query := `SELECT p.match_id, p.home_goals, p.away_goals, p.updated_by, p.updated_at
		FROM match_partials p
		JOIN matches m ON p.match_id = m.id
		WHERE m.round = $1`
	rows, err := r.pool.Query(ctx, query, round)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[uuid.UUID]models.MatchPartial)
	for rows.Next() {
		var p models.MatchPartial
		if err := rows.Scan(&p.MatchID, &p.HomeGoals, &p.AwayGoals, &p.UpdatedBy, &p.UpdatedAt); err != nil {
			return nil, err
		}
		result[p.MatchID] = p
	}
	return result, rows.Err()
}
