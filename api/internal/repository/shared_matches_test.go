package repository

import (
	"context"
	"testing"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type sharedFixture struct {
	pool        *pgxpool.Pool
	competition uuid.UUID
	feedBolao   uuid.UUID
	pastMatch   uuid.UUID
	nextMatch   uuid.UUID
}

func newSharedFixture(t *testing.T) sharedFixture {
	t.Helper()
	pool := pushTestPool(t)
	ctx := context.Background()
	f := sharedFixture{pool: pool}
	if err := pool.QueryRow(ctx, `INSERT INTO competitions (provider, provider_code, name, season) VALUES ('football-data', $1, 'Teste', 2030) RETURNING id`, "T"+uuid.NewString()[:6]).Scan(&f.competition); err != nil {
		t.Fatalf("competition: %v", err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO boloes (name, status, competition_id) VALUES ('Feed', 'finished', $1) RETURNING id`, f.competition).Scan(&f.feedBolao); err != nil {
		t.Fatalf("feed bolão: %v", err)
	}
	t.Cleanup(func() {
		ctx := context.Background()
		_, _ = pool.Exec(ctx, `DELETE FROM matches WHERE competition_id = $1`, f.competition)
		_, _ = pool.Exec(ctx, `DELETE FROM boloes WHERE competition_id = $1`, f.competition)
		_, _ = pool.Exec(ctx, `DELETE FROM competitions WHERE id = $1`, f.competition)
	})
	insert := func(round int, kickoff time.Time) uuid.UUID {
		id := uuid.New()
		if _, err := pool.Exec(ctx, `INSERT INTO matches (id, bolao_id, competition_id, round, home_team, away_team, kickoff_at, market_closes_at, status)
			VALUES ($1, $2, $3, $4, 'Bahia', 'Santos', $5, $5, 'timed')`, id, f.feedBolao, f.competition, round, kickoff); err != nil {
			t.Fatalf("match: %v", err)
		}
		return id
	}
	f.pastMatch = insert(30, time.Now().Add(-48*time.Hour))
	f.nextMatch = insert(31, time.Now().Add(48*time.Hour))
	return f
}

func TestSharedMatches_ANewBolaoSeesTheCompetitionFromTheNextRound(t *testing.T) {
	f := newSharedFixture(t)
	ctx := context.Background()
	b, err := NewBolaoRepository(f.pool).CreateOwnedOn(ctx, "Novo no feed", newUser(t, f.pool), &f.competition)
	if err != nil {
		t.Fatalf("CreateOwned: %v", err)
	}
	if b.FirstRound == nil || *b.FirstRound != 31 || b.CompetitionID == nil || *b.CompetitionID != f.competition {
		t.Fatalf("bolão = %+v, want competition and first round 31", b)
	}
	matches := NewMatchRepository(f.pool)

	rounds, err := matches.ListRounds(ctx, b.ID)
	if err != nil || len(rounds) != 1 || rounds[0] != 31 {
		t.Errorf("rounds = %v, %v; want [31]", rounds, err)
	}
	next, err := matches.ListByRound(ctx, b.ID, 31)
	if err != nil || len(next) != 1 || next[0].ID != f.nextMatch {
		t.Errorf("round 31 = %v, %v; want the shared match", next, err)
	}
	past, err := matches.ListByRound(ctx, b.ID, 30)
	if err != nil || len(past) != 0 {
		t.Errorf("round 30 = %v, %v; want nothing before the bolão started", past, err)
	}
	all, err := matches.ListAllByBolao(ctx, b.ID)
	if err != nil || len(all) != 1 {
		t.Errorf("all = %d, %v; want 1", len(all), err)
	}
}

func TestSharedMatches_APredictionCountsInEveryBolaoOnTheCompetition(t *testing.T) {
	f := newSharedFixture(t)
	ctx := context.Background()
	user := newUser(t, f.pool)
	b, err := NewBolaoRepository(f.pool).CreateOwnedOn(ctx, "Segundo", user, &f.competition)
	if err != nil {
		t.Fatalf("CreateOwned: %v", err)
	}
	if err := NewPredictionRepository(f.pool).Upsert(ctx, &models.Prediction{ID: uuid.New(), UserID: user, MatchID: f.nextMatch, HomeGoals: 2, AwayGoals: 1}); err != nil {
		t.Fatalf("Upsert: %v", err)
	}

	mine, err := NewPredictionRepository(f.pool).GetByUserAndRound(ctx, user, b.ID, 31)
	if err != nil || len(mine) != 1 {
		t.Errorf("predictions in the new bolão = %d, %v; want 1", len(mine), err)
	}
	all, err := NewPredictionRepository(f.pool).GetAllForBolao(ctx, b.ID)
	if err != nil || len(all) != 1 {
		t.Errorf("all predictions = %d, %v; want 1", len(all), err)
	}
}

func TestSharedMatches_ABolaoWithoutFirstRoundSeesOnlyItsOwnMatches(t *testing.T) {
	f := newSharedFixture(t)
	ctx := context.Background()
	var other uuid.UUID
	if err := f.pool.QueryRow(ctx, `INSERT INTO boloes (name, status, competition_id) VALUES ('Legado', 'finished', $1) RETURNING id`, f.competition).Scan(&other); err != nil {
		t.Fatalf("bolão: %v", err)
	}
	rounds, err := NewMatchRepository(f.pool).ListRounds(ctx, other)
	if err != nil || len(rounds) != 0 {
		t.Errorf("rounds = %v, %v; want none", rounds, err)
	}
}

func TestSharedMatches_BelongsToBolao(t *testing.T) {
	f := newSharedFixture(t)
	ctx := context.Background()
	b, err := NewBolaoRepository(f.pool).CreateOwnedOn(ctx, "Pertence", newUser(t, f.pool), &f.competition)
	if err != nil {
		t.Fatalf("CreateOwnedOn: %v", err)
	}
	matches := NewMatchRepository(f.pool)
	for match, want := range map[uuid.UUID]bool{f.nextMatch: true, f.pastMatch: false} {
		got, err := matches.BelongsToBolao(ctx, match, b.ID)
		if err != nil || got != want {
			t.Errorf("BelongsToBolao(%v) = %v, %v; want %v", match, got, err, want)
		}
	}
	if own, err := matches.BelongsToBolao(ctx, f.pastMatch, f.feedBolao); err != nil || !own {
		t.Errorf("the feed bolão's own match = %v, %v; want true", own, err)
	}
}

func TestCompetitionRepository_ListActive(t *testing.T) {
	f := newSharedFixture(t)
	ctx := context.Background()
	if _, err := f.pool.Exec(ctx, `UPDATE competitions SET status = 'finished' WHERE id = $1`, f.competition); err != nil {
		t.Fatalf("finish: %v", err)
	}
	competitions, err := NewCompetitionRepository(f.pool).ListActive(ctx)
	if err != nil {
		t.Fatalf("ListActive: %v", err)
	}
	for _, c := range competitions {
		if c.ID == f.competition || c.Status != "active" {
			t.Errorf("competition %s (%s) listed, want only active ones", c.Name, c.Status)
		}
	}
}
