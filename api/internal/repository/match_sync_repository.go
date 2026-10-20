package repository

import (
	"context"
	"errors"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const footballDataProvider = "football-data"

type MatchSyncRepository struct {
	pool *pgxpool.Pool
}

func NewMatchSyncRepository(pool *pgxpool.Pool) *MatchSyncRepository {
	return &MatchSyncRepository{pool: pool}
}

func (r *MatchSyncRepository) ListSyncTargets(ctx context.Context) ([]models.SyncTarget, error) {
	query := `
		SELECT DISTINCT ON (c.id) c.id, c.provider_code, c.season, b.id, b.started_at, c.last_synced_at
		FROM competitions c
		JOIN boloes b ON b.competition_id = c.id AND b.status = 'active'
		WHERE c.status = 'active' AND c.provider = $1
		ORDER BY c.id, b.started_at`
	rows, err := r.pool.Query(ctx, query, footballDataProvider)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var targets []models.SyncTarget
	for rows.Next() {
		var t models.SyncTarget
		if err := rows.Scan(&t.CompetitionID, &t.Code, &t.Season, &t.BolaoID, &t.BolaoStartedAt, &t.LastSyncedAt); err != nil {
			return nil, err
		}
		targets = append(targets, t)
	}
	return targets, rows.Err()
}

func (r *MatchSyncRepository) ListByCompetition(ctx context.Context, competitionID uuid.UUID) ([]models.Match, error) {
	query := `SELECT id, bolao_id, competition_id, provider_match_id, round, home_team, away_team, kickoff_at, market_closes_at, home_goals, away_goals, status, locked, created_at, updated_at
		FROM matches WHERE competition_id = $1 ORDER BY round, kickoff_at`
	rows, err := r.pool.Query(ctx, query, competitionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var matches []models.Match
	for rows.Next() {
		var m models.Match
		if err := rows.Scan(&m.ID, &m.BolaoID, &m.CompetitionID, &m.ProviderMatchID, &m.Round, &m.HomeTeam, &m.AwayTeam, &m.KickoffAt, &m.MarketClosesAt, &m.HomeGoals, &m.AwayGoals, &m.Status, &m.Locked, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		matches = append(matches, m)
	}
	return matches, rows.Err()
}

func (r *MatchSyncRepository) ApplyPlan(ctx context.Context, plan models.ReconcilePlan) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	for _, m := range plan.Inserts {
		if _, err := tx.Exec(ctx, `
			INSERT INTO matches (id, bolao_id, competition_id, provider_match_id, round, home_team, away_team, kickoff_at, market_closes_at, home_goals, away_goals, status)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
			m.ID, m.BolaoID, m.CompetitionID, m.ProviderMatchID, m.Round, m.HomeTeam, m.AwayTeam, m.KickoffAt, m.MarketClosesAt, m.HomeGoals, m.AwayGoals, m.Status,
		); err != nil {
			return err
		}
	}
	for _, m := range plan.Updates {
		if _, err := tx.Exec(ctx, `
			UPDATE matches SET provider_match_id = $2, round = $3, home_team = $4, away_team = $5, kickoff_at = $6,
				market_closes_at = $7, home_goals = $8, away_goals = $9, status = $10, updated_at = CURRENT_TIMESTAMP
			WHERE id = $1 AND locked = false`,
			m.ID, m.ProviderMatchID, m.Round, m.HomeTeam, m.AwayTeam, m.KickoffAt, m.MarketClosesAt, m.HomeGoals, m.AwayGoals, m.Status,
		); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *MatchSyncRepository) MarkSynced(ctx context.Context, competitionID uuid.UUID, at time.Time) error {
	_, err := r.pool.Exec(ctx, `UPDATE competitions SET last_synced_at = $2, sync_failures = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, competitionID, at)
	return err
}

func (r *MatchSyncRepository) MarkFailed(ctx context.Context, competitionID uuid.UUID) (int, error) {
	var failures int
	err := r.pool.QueryRow(ctx, `UPDATE competitions SET sync_failures = sync_failures + 1 WHERE id = $1 RETURNING sync_failures`, competitionID).Scan(&failures)
	return failures, err
}

func (r *MatchSyncRepository) ReserveCall(ctx context.Context, day time.Time, limit int) (bool, error) {
	var calls int
	err := r.pool.QueryRow(ctx, `
		INSERT INTO provider_calls (day, provider, calls) VALUES ($1::date, $2, 1)
		ON CONFLICT (day, provider) DO UPDATE SET calls = provider_calls.calls + 1
		WHERE provider_calls.calls < $3
		RETURNING calls`, day.UTC(), footballDataProvider, limit).Scan(&calls)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}
