package repository

import (
	"context"
	"testing"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

func TestCompetitionRepository_ActiveBolaoIsLinkedToBrasileirao(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	bolao, err := NewBolaoRepository(pool).GetActive(ctx)
	if err != nil {
		t.Fatalf("active bolão: %v", err)
	}

	competition, err := NewCompetitionRepository(pool).GetByBolao(ctx, bolao.ID)
	if err != nil {
		t.Fatalf("GetByBolao: %v", err)
	}
	if competition.Provider != "football-data" || competition.ProviderCode != "BSA" || competition.Season != 2026 {
		t.Errorf("competition = %+v, want football-data BSA 2026", competition)
	}
}

func TestCompetitionRepository_MatchesOfALinkedBolaoGetItsCompetition(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	bolao, err := NewBolaoRepository(pool).GetActive(ctx)
	if err != nil {
		t.Fatalf("active bolão: %v", err)
	}
	closes := time.Now().Add(time.Hour)
	match := &models.Match{ID: uuid.New(), BolaoID: bolao.ID, Round: 97, HomeTeam: "Flamengo", AwayTeam: "Palmeiras", MarketClosesAt: &closes}
	if err := NewMatchRepository(pool).Create(ctx, match); err != nil {
		t.Fatalf("create match: %v", err)
	}
	t.Cleanup(func() { _ = NewMatchRepository(pool).Delete(ctx, match.ID) })

	got, err := NewMatchRepository(pool).GetByID(ctx, match.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	competition, err := NewCompetitionRepository(pool).GetByBolao(ctx, bolao.ID)
	if err != nil {
		t.Fatalf("GetByBolao: %v", err)
	}
	if got.CompetitionID == nil || *got.CompetitionID != competition.ID {
		t.Errorf("match competition = %v, want %v", got.CompetitionID, competition.ID)
	}
	if got.Status != models.MatchStatusScheduled {
		t.Errorf("match status = %q, want %q", got.Status, models.MatchStatusScheduled)
	}
}

func TestCompetitionMigration_RunsTwice(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	var count int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM competitions WHERE provider_code = 'BSA' AND season = 2026`).Scan(&count); err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 1 {
		t.Errorf("BSA 2026 rows = %d, want 1", count)
	}
}
