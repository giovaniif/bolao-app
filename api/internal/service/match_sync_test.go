package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

type fakeFeed struct {
	calls   []string
	matches []FeedMatch
	err     error
}

func (f *fakeFeed) FeedMatches(_ context.Context, code string, _ int) ([]FeedMatch, error) {
	f.calls = append(f.calls, code)
	return f.matches, f.err
}

type fakeSyncStore struct {
	targets  []SyncTarget
	matches  []models.Match
	plans    []ReconcilePlan
	synced   []uuid.UUID
	failed   []uuid.UUID
	budget   int
	reserved int
}

func (s *fakeSyncStore) ListSyncTargets(context.Context) ([]SyncTarget, error) { return s.targets, nil }

func (s *fakeSyncStore) ListByCompetition(context.Context, uuid.UUID) ([]models.Match, error) {
	return s.matches, nil
}

func (s *fakeSyncStore) ApplyPlan(_ context.Context, plan ReconcilePlan) error {
	s.plans = append(s.plans, plan)
	return nil
}

func (s *fakeSyncStore) MarkSynced(_ context.Context, id uuid.UUID, _ time.Time) error {
	s.synced = append(s.synced, id)
	return nil
}

func (s *fakeSyncStore) MarkFailed(_ context.Context, id uuid.UUID) (int, error) {
	s.failed = append(s.failed, id)
	return len(s.failed), nil
}

func (s *fakeSyncStore) ReserveCall(_ context.Context, _ time.Time, limit int) (bool, error) {
	if s.reserved >= s.budget || s.reserved >= limit {
		return false, nil
	}
	s.reserved++
	return true, nil
}

var syncNow = time.Date(2026, 10, 25, 20, 0, 0, 0, time.UTC)

func target(lastSynced *time.Time) SyncTarget {
	return SyncTarget{CompetitionID: uuid.New(), Code: "BSA", Season: 2026, BolaoID: uuid.New(), BolaoStartedAt: syncNow.Add(-90 * 24 * time.Hour), LastSyncedAt: lastSynced}
}

func ago(d time.Duration) *time.Time {
	t := syncNow.Add(-d)
	return &t
}

func liveMatch() models.Match {
	k := syncNow.Add(-time.Hour)
	return models.Match{KickoffAt: &k, Status: models.MatchStatusLive}
}

func TestMatchSync_WhenToCallTheProvider(t *testing.T) {
	tests := []struct {
		name      string
		target    SyncTarget
		matches   []models.Match
		wantCalls int
	}{
		{"a competition never synced is synced", target(nil), nil, 1},
		{"fixtures synced an hour ago with no live match wait", target(ago(time.Hour)), nil, 0},
		{"fixtures older than a day are synced", target(ago(25 * time.Hour)), nil, 1},
		{"a live match syncs results after 5 minutes", target(ago(6 * time.Minute)), []models.Match{liveMatch()}, 1},
		{"a live match does not sync again within 5 minutes", target(ago(2 * time.Minute)), []models.Match{liveMatch()}, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			feed := &fakeFeed{}
			store := &fakeSyncStore{targets: []SyncTarget{tt.target}, matches: tt.matches, budget: 100}
			if _, err := NewMatchSyncService(feed, store, func() time.Time { return syncNow }).RunOnce(context.Background()); err != nil {
				t.Fatalf("RunOnce: %v", err)
			}
			if len(feed.calls) != tt.wantCalls {
				t.Errorf("provider calls = %d, want %d", len(feed.calls), tt.wantCalls)
			}
			if len(store.synced) != tt.wantCalls {
				t.Errorf("marked synced = %d, want %d", len(store.synced), tt.wantCalls)
			}
		})
	}
}

func TestMatchSync_AppliesTheReconcilePlanInsideTheWindow(t *testing.T) {
	soon := FeedMatch{ProviderID: 1, Kickoff: syncNow.Add(3 * 24 * time.Hour), Status: FeedStatusTimed, Stage: StageRegularSeason, Matchday: 32, HomeTeam: "Flamengo", AwayTeam: "Palmeiras"}
	late := soon
	late.ProviderID, late.Matchday, late.Kickoff = 2, 35, syncNow.Add(20*24*time.Hour)
	beforeBolao := soon
	beforeBolao.ProviderID, beforeBolao.Matchday, beforeBolao.Kickoff = 3, 1, syncNow.Add(-100*24*time.Hour)
	feed := &fakeFeed{matches: []FeedMatch{soon, late, beforeBolao}}
	tgt := target(nil)
	store := &fakeSyncStore{targets: []SyncTarget{tgt}, budget: 100}

	if _, err := NewMatchSyncService(feed, store, func() time.Time { return syncNow }).RunOnce(context.Background()); err != nil {
		t.Fatalf("RunOnce: %v", err)
	}
	if len(store.plans) != 1 || len(store.plans[0].Inserts) != 1 || *store.plans[0].Inserts[0].ProviderMatchID != 1 {
		t.Fatalf("plans = %+v, want one insert of provider match 1", store.plans)
	}
	if store.plans[0].Inserts[0].BolaoID != tgt.BolaoID {
		t.Errorf("insert bolão = %v, want %v", store.plans[0].Inserts[0].BolaoID, tgt.BolaoID)
	}
}

func TestMatchSync_StopsAtTheDailyBudget(t *testing.T) {
	feed := &fakeFeed{}
	store := &fakeSyncStore{targets: []SyncTarget{target(nil), target(nil)}, budget: 1}

	if _, err := NewMatchSyncService(feed, store, func() time.Time { return syncNow }).RunOnce(context.Background()); err != nil {
		t.Fatalf("RunOnce: %v", err)
	}
	if len(feed.calls) != 1 {
		t.Errorf("provider calls = %d, want 1", len(feed.calls))
	}
}

func TestMatchSync_AProviderErrorMarksAFailureAndKeepsTheData(t *testing.T) {
	feed := &fakeFeed{err: errors.New("status 500")}
	store := &fakeSyncStore{targets: []SyncTarget{target(nil)}, budget: 100}

	report, err := NewMatchSyncService(feed, store, func() time.Time { return syncNow }).RunOnce(context.Background())
	if err == nil {
		t.Fatal("err = nil, want the provider error")
	}
	if len(store.failed) != 1 || len(store.plans) != 0 || len(store.synced) != 0 {
		t.Errorf("failed = %d plans = %d synced = %d, want 1, 0, 0", len(store.failed), len(store.plans), len(store.synced))
	}
	if report.Failed != 1 {
		t.Errorf("report = %+v, want 1 failed", report)
	}
}

func TestMatchSync_NeverInsertsARoundThatAlreadyStarted(t *testing.T) {
	started := FeedMatch{ProviderID: 1, Kickoff: syncNow.Add(-2 * 24 * time.Hour), Status: FeedStatusFinished, Stage: StageRegularSeason, Matchday: 30, HomeTeam: "Bahia", AwayTeam: "Santos"}
	feed := &fakeFeed{matches: []FeedMatch{started}}
	store := &fakeSyncStore{targets: []SyncTarget{target(nil)}, budget: 100}

	if _, err := NewMatchSyncService(feed, store, func() time.Time { return syncNow }).RunOnce(context.Background()); err != nil {
		t.Fatalf("RunOnce: %v", err)
	}
	if len(store.plans) != 1 || len(store.plans[0].Inserts) != 0 {
		t.Errorf("plans = %+v, want no insert of a round that started after the bolão but before now", store.plans)
	}
}
