package repository

import (
	"context"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type MatchRepository struct {
	pool *pgxpool.Pool
}

func NewMatchRepository(pool *pgxpool.Pool) *MatchRepository {
	return &MatchRepository{pool: pool}
}

func (r *MatchRepository) Create(ctx context.Context, m *models.Match) error {
	query := `
		INSERT INTO matches (id, bolao_id, competition_id, round, home_team, away_team, market_closes_at)
		VALUES ($1, $2, (SELECT competition_id FROM boloes WHERE id = $2), $3, $4, $5, $6)
		RETURNING competition_id, status, locked, created_at, updated_at`
	return r.pool.QueryRow(ctx, query, m.ID, m.BolaoID, m.Round, m.HomeTeam, m.AwayTeam, m.MarketClosesAt).Scan(&m.CompetitionID, &m.Status, &m.Locked, &m.CreatedAt, &m.UpdatedAt)
}

func (r *MatchRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Match, error) {
	var m models.Match
	query := `SELECT id, bolao_id, competition_id, provider_match_id, round, home_team, away_team, kickoff_at, market_closes_at, home_goals, away_goals, status, locked, created_at, updated_at
		FROM matches WHERE id = $1`
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&m.ID, &m.BolaoID, &m.CompetitionID, &m.ProviderMatchID, &m.Round, &m.HomeTeam, &m.AwayTeam, &m.KickoffAt, &m.MarketClosesAt, &m.HomeGoals, &m.AwayGoals, &m.Status, &m.Locked, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *MatchRepository) ListByRound(ctx context.Context, bolaoID uuid.UUID, round int) ([]models.Match, error) {
	query := `SELECT id, bolao_id, competition_id, provider_match_id, round, home_team, away_team, kickoff_at, market_closes_at, home_goals, away_goals, status, locked, created_at, updated_at
		FROM matches m WHERE ` + matchInBolao("$1") + ` AND m.round = $2 ORDER BY m.kickoff_at NULLS LAST, m.created_at`
	rows, err := r.pool.Query(ctx, query, bolaoID, round)
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

func (r *MatchRepository) ListAllByBolao(ctx context.Context, bolaoID uuid.UUID) ([]models.Match, error) {
	query := `SELECT id, bolao_id, competition_id, provider_match_id, round, home_team, away_team, kickoff_at, market_closes_at, home_goals, away_goals, status, locked, created_at, updated_at
		FROM matches m WHERE ` + matchInBolao("$1") + ` ORDER BY m.round, m.kickoff_at NULLS LAST, m.created_at`
	rows, err := r.pool.Query(ctx, query, bolaoID)
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

func (r *MatchRepository) ListRounds(ctx context.Context, bolaoID uuid.UUID) ([]int, error) {
	query := `SELECT DISTINCT m.round FROM matches m WHERE ` + matchInBolao("$1") + ` ORDER BY m.round`
	rows, err := r.pool.Query(ctx, query, bolaoID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rounds []int
	for rows.Next() {
		var r int
		if err := rows.Scan(&r); err != nil {
			return nil, err
		}
		rounds = append(rounds, r)
	}
	return rounds, rows.Err()
}

func (r *MatchRepository) UpdateResults(ctx context.Context, id uuid.UUID, homeGoals, awayGoals int) error {
	query := `UPDATE matches SET home_goals = $2, away_goals = $3, locked = locked OR provider_match_id IS NOT NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id, homeGoals, awayGoals)
	return err
}

func (r *MatchRepository) UpdateMarketClosesAt(ctx context.Context, bolaoID uuid.UUID, round int, closesAt *time.Time) error {
	query := `UPDATE matches SET market_closes_at = $3, updated_at = CURRENT_TIMESTAMP WHERE bolao_id = $1 AND round = $2`
	_, err := r.pool.Exec(ctx, query, bolaoID, round, closesAt)
	return err
}

func (r *MatchRepository) Update(ctx context.Context, id uuid.UUID, homeTeam, awayTeam string) error {
	query := `UPDATE matches SET home_team = $2, away_team = $3, locked = locked OR provider_match_id IS NOT NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id, homeTeam, awayTeam)
	return err
}

func (r *MatchRepository) Unlock(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE matches SET locked = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}

func (r *MatchRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM matches WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}

func (r *MatchRepository) DeleteRound(ctx context.Context, bolaoID uuid.UUID, round int) error {
	query := `DELETE FROM matches WHERE bolao_id = $1 AND round = $2`
	_, err := r.pool.Exec(ctx, query, bolaoID, round)
	return err
}

func (r *MatchRepository) BelongsToBolao(ctx context.Context, matchID, bolaoID uuid.UUID) (bool, error) {
	var belongs bool
	query := `SELECT EXISTS (SELECT 1 FROM matches m WHERE m.id = $1 AND ` + matchInBolao("$2") + `)`
	err := r.pool.QueryRow(ctx, query, matchID, bolaoID).Scan(&belongs)
	return belongs, err
}
