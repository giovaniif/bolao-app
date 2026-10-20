package repository

import (
	"context"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CompetitionRepository struct {
	pool *pgxpool.Pool
}

func NewCompetitionRepository(pool *pgxpool.Pool) *CompetitionRepository {
	return &CompetitionRepository{pool: pool}
}

func (r *CompetitionRepository) GetByBolao(ctx context.Context, bolaoID uuid.UUID) (*models.Competition, error) {
	var c models.Competition
	query := `SELECT c.id, c.provider, c.provider_code, c.name, c.season, c.status, c.created_at, c.updated_at
		FROM competitions c JOIN boloes b ON b.competition_id = c.id
		WHERE b.id = $1`
	err := r.pool.QueryRow(ctx, query, bolaoID).Scan(
		&c.ID, &c.Provider, &c.ProviderCode, &c.Name, &c.Season, &c.Status, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *CompetitionRepository) ListActive(ctx context.Context) ([]models.Competition, error) {
	query := `SELECT id, provider, provider_code, name, season, status, created_at, updated_at
		FROM competitions WHERE status = 'active' ORDER BY name`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	competitions := []models.Competition{}
	for rows.Next() {
		var c models.Competition
		if err := rows.Scan(&c.ID, &c.Provider, &c.ProviderCode, &c.Name, &c.Season, &c.Status, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		competitions = append(competitions, c)
	}
	return competitions, rows.Err()
}
