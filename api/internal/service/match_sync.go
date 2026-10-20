package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

const (
	DailyProviderCallBudget = 200
	fixturesSyncInterval    = 24 * time.Hour
	resultsSyncInterval     = 5 * time.Minute
	insertAhead             = 14 * 24 * time.Hour
)

type SyncTarget = models.SyncTarget

type SyncReport struct {
	Synced  int
	Skipped int
	Failed  int
}

type MatchFeed interface {
	FeedMatches(ctx context.Context, code string, season int) ([]FeedMatch, error)
}

type MatchSyncStore interface {
	ListSyncTargets(ctx context.Context) ([]SyncTarget, error)
	ListByCompetition(ctx context.Context, competitionID uuid.UUID) ([]models.Match, error)
	ApplyPlan(ctx context.Context, plan ReconcilePlan) error
	MarkSynced(ctx context.Context, competitionID uuid.UUID, at time.Time) error
	MarkFailed(ctx context.Context, competitionID uuid.UUID) (int, error)
	ReserveCall(ctx context.Context, day time.Time, limit int) (bool, error)
}

type MatchSyncService struct {
	feed  MatchFeed
	store MatchSyncStore
	now   func() time.Time
}

func NewMatchSyncService(feed MatchFeed, store MatchSyncStore, now func() time.Time) *MatchSyncService {
	return &MatchSyncService{feed: feed, store: store, now: now}
}

func SyncDue(target SyncTarget, matches []models.Match, now time.Time) bool {
	if target.LastSyncedAt == nil {
		return true
	}
	since := now.Sub(*target.LastSyncedAt)
	return since >= fixturesSyncInterval || (since >= resultsSyncInterval && NeedsResultsSync(matches, now))
}

func (s *MatchSyncService) RunOnce(ctx context.Context) (SyncReport, error) {
	var report SyncReport
	targets, err := s.store.ListSyncTargets(ctx)
	if err != nil {
		return report, err
	}
	var errs []error
	for _, target := range targets {
		synced, err := s.syncTarget(ctx, target)
		switch {
		case err != nil:
			report.Failed++
			failures, markErr := s.store.MarkFailed(ctx, target.CompetitionID)
			errs = append(errs, fmt.Errorf("sync %s %d (failure %d): %w", target.Code, target.Season, failures, errors.Join(err, markErr)))
		case synced:
			report.Synced++
		default:
			report.Skipped++
		}
	}
	return report, errors.Join(errs...)
}

func (s *MatchSyncService) syncTarget(ctx context.Context, target SyncTarget) (bool, error) {
	now := s.now()
	local, err := s.store.ListByCompetition(ctx, target.CompetitionID)
	if err != nil {
		return false, err
	}
	if !SyncDue(target, local, now) {
		return false, nil
	}
	allowed, err := s.store.ReserveCall(ctx, now, DailyProviderCallBudget)
	if err != nil || !allowed {
		return false, err
	}
	remote, err := s.feed.FeedMatches(ctx, target.Code, target.Season)
	if err != nil {
		return false, err
	}
	from := target.BolaoStartedAt
	if now.After(from) {
		from = now
	}
	window := InsertWindow{From: from, To: now.Add(insertAhead)}
	if err := s.store.ApplyPlan(ctx, ReconcileMatches(target.CompetitionID, target.BolaoID, local, remote, window)); err != nil {
		return false, err
	}
	return true, s.store.MarkSynced(ctx, target.CompetitionID, now)
}
