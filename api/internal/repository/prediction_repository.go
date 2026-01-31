package repository

import (
	"context"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PredictionRepository struct {
	pool *pgxpool.Pool
}

func NewPredictionRepository(pool *pgxpool.Pool) *PredictionRepository {
	return &PredictionRepository{pool: pool}
}

func (r *PredictionRepository) Upsert(ctx context.Context, p *models.Prediction) error {
	query := `
		INSERT INTO predictions (id, user_id, match_id, home_goals, away_goals)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, match_id) DO UPDATE SET home_goals = $4, away_goals = $5, updated_at = CURRENT_TIMESTAMP
		RETURNING created_at, updated_at`
	return r.pool.QueryRow(ctx, query, p.ID, p.UserID, p.MatchID, p.HomeGoals, p.AwayGoals).Scan(&p.CreatedAt, &p.UpdatedAt)
}

func (r *PredictionRepository) GetByUserAndMatch(ctx context.Context, userID, matchID uuid.UUID) (*models.Prediction, error) {
	var p models.Prediction
	query := `SELECT id, user_id, match_id, home_goals, away_goals, created_at, updated_at
		FROM predictions WHERE user_id = $1 AND match_id = $2`
	err := r.pool.QueryRow(ctx, query, userID, matchID).Scan(&p.ID, &p.UserID, &p.MatchID, &p.HomeGoals, &p.AwayGoals, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *PredictionRepository) GetByUserAndRound(ctx context.Context, userID uuid.UUID, round int) ([]models.Prediction, error) {
	query := `SELECT p.id, p.user_id, p.match_id, p.home_goals, p.away_goals, p.created_at, p.updated_at
		FROM predictions p
		JOIN matches m ON p.match_id = m.id
		WHERE p.user_id = $1 AND m.round = $2`
	rows, err := r.pool.Query(ctx, query, userID, round)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var predictions []models.Prediction
	for rows.Next() {
		var p models.Prediction
		if err := rows.Scan(&p.ID, &p.UserID, &p.MatchID, &p.HomeGoals, &p.AwayGoals, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		predictions = append(predictions, p)
	}
	return predictions, rows.Err()
}

func (r *PredictionRepository) GetByMatch(ctx context.Context, matchID uuid.UUID) ([]models.Prediction, error) {
	query := `SELECT id, user_id, match_id, home_goals, away_goals, created_at, updated_at
		FROM predictions WHERE match_id = $1`
	rows, err := r.pool.Query(ctx, query, matchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var predictions []models.Prediction
	for rows.Next() {
		var p models.Prediction
		if err := rows.Scan(&p.ID, &p.UserID, &p.MatchID, &p.HomeGoals, &p.AwayGoals, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		predictions = append(predictions, p)
	}
	return predictions, rows.Err()
}

func (r *PredictionRepository) GetAllPredictionsForRound(ctx context.Context, round int) ([]models.Prediction, error) {
	query := `SELECT p.id, p.user_id, p.match_id, p.home_goals, p.away_goals, p.created_at, p.updated_at
		FROM predictions p
		JOIN matches m ON p.match_id = m.id
		WHERE m.round = $1`
	rows, err := r.pool.Query(ctx, query, round)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var predictions []models.Prediction
	for rows.Next() {
		var p models.Prediction
		if err := rows.Scan(&p.ID, &p.UserID, &p.MatchID, &p.HomeGoals, &p.AwayGoals, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		predictions = append(predictions, p)
	}
	return predictions, rows.Err()
}
