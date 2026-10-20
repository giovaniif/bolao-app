package repository

import (
	"context"
	"testing"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

func lockTestMatch(t *testing.T, feed bool) (*MatchRepository, uuid.UUID) {
	t.Helper()
	pool := pushTestPool(t)
	ctx := context.Background()
	bolao, err := NewBolaoRepository(pool).GetActive(ctx)
	if err != nil {
		t.Fatalf("active bolão: %v", err)
	}
	repo := NewMatchRepository(pool)
	closes := time.Now().Add(time.Hour)
	m := &models.Match{ID: uuid.New(), BolaoID: bolao.ID, Round: 95, HomeTeam: "Bahia", AwayTeam: "Santos", MarketClosesAt: &closes}
	if err := repo.Create(ctx, m); err != nil {
		t.Fatalf("create: %v", err)
	}
	t.Cleanup(func() { _ = repo.Delete(ctx, m.ID) })
	if feed {
		if _, err := pool.Exec(ctx, `UPDATE matches SET provider_match_id = $2 WHERE id = $1`, m.ID, int64(uuid.New().ID())); err != nil {
			t.Fatalf("link: %v", err)
		}
	}
	return repo, m.ID
}

func TestMatchRepository_LocksAFeedMatchWhenAnAdminEditsIt(t *testing.T) {
	edits := []struct {
		name string
		edit func(r *MatchRepository, id uuid.UUID) error
	}{
		{"results", func(r *MatchRepository, id uuid.UUID) error { return r.UpdateResults(context.Background(), id, 1, 0) }},
		{"teams", func(r *MatchRepository, id uuid.UUID) error {
			return r.Update(context.Background(), id, "Bahia", "Remo")
		}},
	}
	for _, e := range edits {
		for _, feed := range []bool{true, false} {
			repo, id := lockTestMatch(t, feed)
			if err := e.edit(repo, id); err != nil {
				t.Fatalf("%s: %v", e.name, err)
			}
			m, err := repo.GetByID(context.Background(), id)
			if err != nil {
				t.Fatalf("GetByID: %v", err)
			}
			if m.Locked != feed {
				t.Errorf("%s edit, feed match %v: locked = %v, want %v", e.name, feed, m.Locked, feed)
			}
		}
	}
}

func TestMatchRepository_UnlockHandsTheMatchBackToTheSync(t *testing.T) {
	repo, id := lockTestMatch(t, true)
	ctx := context.Background()
	if err := repo.UpdateResults(ctx, id, 1, 0); err != nil {
		t.Fatalf("UpdateResults: %v", err)
	}
	if err := repo.Unlock(ctx, id); err != nil {
		t.Fatalf("Unlock: %v", err)
	}
	m, err := repo.GetByID(ctx, id)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if m.Locked {
		t.Error("locked = true after Unlock, want false")
	}
}
