package repository

import (
	"context"
	"testing"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

func TestMatchSyncRepository_ReserveCallStopsAtTheLimit(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	repo := NewMatchSyncRepository(pool)
	day := time.Date(2001, 1, 1, 12, 0, 0, 0, time.UTC).Add(time.Duration(uuid.New().ID()%100000) * 24 * time.Hour)

	for i := range 2 {
		ok, err := repo.ReserveCall(ctx, day, 2)
		if err != nil || !ok {
			t.Fatalf("call %d: ok = %v err = %v, want allowed", i+1, ok, err)
		}
	}
	ok, err := repo.ReserveCall(ctx, day, 2)
	if err != nil || ok {
		t.Errorf("third call: ok = %v err = %v, want refused", ok, err)
	}
}

func TestMatchSyncRepository_TargetsTheActiveBolaoOfEachCompetition(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	bolao, err := NewBolaoRepository(pool).GetActive(ctx)
	if err != nil {
		t.Fatalf("active bolão: %v", err)
	}

	targets, err := NewMatchSyncRepository(pool).ListSyncTargets(ctx)
	if err != nil {
		t.Fatalf("ListSyncTargets: %v", err)
	}
	if len(targets) != 1 || targets[0].Code != "BSA" || targets[0].Season != 2026 || targets[0].BolaoID != bolao.ID {
		t.Errorf("targets = %+v, want BSA 2026 for the active bolão", targets)
	}
}

func TestMatchSyncRepository_ApplyPlanInsertsUpdatesAndSkipsLockedMatches(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	repo := NewMatchSyncRepository(pool)
	bolao, err := NewBolaoRepository(pool).GetActive(ctx)
	if err != nil {
		t.Fatalf("active bolão: %v", err)
	}
	competition, err := NewCompetitionRepository(pool).GetByBolao(ctx, bolao.ID)
	if err != nil {
		t.Fatalf("competition: %v", err)
	}
	kickoff := time.Date(2026, 11, 1, 19, 0, 0, 0, time.UTC)
	pid := int64(uuid.New().ID())
	inserted := models.Match{ID: uuid.New(), BolaoID: bolao.ID, CompetitionID: &competition.ID, ProviderMatchID: &pid, Round: 96, HomeTeam: "Bahia", AwayTeam: "Santos", KickoffAt: &kickoff, MarketClosesAt: &kickoff, Status: models.MatchStatusTimed}
	if err := repo.ApplyPlan(ctx, models.ReconcilePlan{Inserts: []models.Match{inserted}}); err != nil {
		t.Fatalf("insert: %v", err)
	}
	t.Cleanup(func() { _ = NewMatchRepository(pool).Delete(ctx, inserted.ID) })

	finished := inserted
	two, one := 2, 1
	finished.Status, finished.HomeGoals, finished.AwayGoals = models.MatchStatusFinished, &two, &one
	if err := repo.ApplyPlan(ctx, models.ReconcilePlan{Updates: []models.Match{finished}}); err != nil {
		t.Fatalf("update: %v", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE matches SET locked = true WHERE id = $1`, inserted.ID); err != nil {
		t.Fatalf("lock: %v", err)
	}
	zero := 0
	finished.HomeGoals = &zero
	if err := repo.ApplyPlan(ctx, models.ReconcilePlan{Updates: []models.Match{finished}}); err != nil {
		t.Fatalf("locked update: %v", err)
	}

	matches, err := repo.ListByCompetition(ctx, competition.ID)
	if err != nil {
		t.Fatalf("ListByCompetition: %v", err)
	}
	for _, m := range matches {
		if m.ID != inserted.ID {
			continue
		}
		if m.Status != models.MatchStatusFinished || *m.HomeGoals != 2 || *m.AwayGoals != 1 || *m.ProviderMatchID != pid {
			t.Errorf("match = %+v, want finished 2 x 1 kept by the lock", m)
		}
		return
	}
	t.Fatal("inserted match not listed")
}

func TestMatchSyncRepository_FailuresCountUntilASync(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	repo := NewMatchSyncRepository(pool)
	var id uuid.UUID
	if err := pool.QueryRow(ctx, `INSERT INTO competitions (provider, provider_code, name, season, status) VALUES ('football-data', 'T'||substr(md5(random()::text),1,6), 'Test', 1999, 'finished') RETURNING id`).Scan(&id); err != nil {
		t.Fatalf("competition: %v", err)
	}

	for want := 1; want <= 2; want++ {
		got, err := repo.MarkFailed(ctx, id)
		if err != nil || got != want {
			t.Errorf("MarkFailed = %d, %v; want %d", got, err, want)
		}
	}
	if err := repo.MarkSynced(ctx, id, time.Now()); err != nil {
		t.Fatalf("MarkSynced: %v", err)
	}
	if got, _ := repo.MarkFailed(ctx, id); got != 1 {
		t.Errorf("MarkFailed after a sync = %d, want 1", got)
	}
}
