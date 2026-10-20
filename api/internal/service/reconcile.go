package service

import (
	"sort"
	"strconv"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

const (
	FeedStatusScheduled = "SCHEDULED"
	FeedStatusTimed     = "TIMED"
	FeedStatusInPlay    = "IN_PLAY"
	FeedStatusPaused    = "PAUSED"
	FeedStatusFinished  = "FINISHED"
	FeedStatusPostponed = "POSTPONED"
	FeedStatusSuspended = "SUSPENDED"
	FeedStatusCancelled = "CANCELLED"
)

const (
	StageRegularSeason = "REGULAR_SEASON"
	StageLeague        = "LEAGUE_STAGE"
	StagePlayoffs      = "PLAYOFFS"
	StageLast16        = "LAST_16"
	StageQuarterFinals = "QUARTER_FINALS"
	StageSemiFinals    = "SEMI_FINALS"
	StageFinal         = "FINAL"
)

const resultsSyncWindow = 24 * time.Hour

var knockoutFirstRound = map[string]int{
	StagePlayoffs:      9,
	StageLast16:        11,
	StageQuarterFinals: 13,
	StageSemiFinals:    15,
	StageFinal:         17,
}

var feedStatuses = map[string]string{
	FeedStatusScheduled: models.MatchStatusScheduled,
	FeedStatusTimed:     models.MatchStatusTimed,
	FeedStatusInPlay:    models.MatchStatusLive,
	FeedStatusPaused:    models.MatchStatusLive,
	FeedStatusFinished:  models.MatchStatusFinished,
	FeedStatusPostponed: models.MatchStatusPostponed,
	FeedStatusSuspended: models.MatchStatusPostponed,
	FeedStatusCancelled: models.MatchStatusCancelled,
}

type FeedMatch struct {
	ProviderID int64
	Kickoff    time.Time
	Status     string
	Stage      string
	Matchday   int
	HomeTeam   string
	AwayTeam   string
	HomeGoals  *int
	AwayGoals  *int
}

type InsertWindow struct {
	From time.Time
	To   time.Time
}

func (w InsertWindow) contains(t time.Time) bool {
	return !t.Before(w.From) && !t.After(w.To)
}

type ReconcilePlan = models.ReconcilePlan

func ReconcileMatches(competitionID, bolaoID uuid.UUID, local []models.Match, remote []FeedMatch, window InsertWindow) ReconcilePlan {
	rounds := feedRounds(remote)
	firstKickoff := map[int]time.Time{}
	for _, f := range remote {
		if k, ok := firstKickoff[rounds[f.ProviderID]]; !ok || f.Kickoff.Before(k) {
			firstKickoff[rounds[f.ProviderID]] = f.Kickoff
		}
	}
	byProvider := map[int64]models.Match{}
	manual := map[string]models.Match{}
	for _, m := range local {
		if m.ProviderMatchID != nil {
			byProvider[*m.ProviderMatchID] = m
		} else {
			manual[manualKey(m.Round, m.HomeTeam, m.AwayTeam)] = m
		}
	}

	var plan ReconcilePlan
	for _, f := range remote {
		round := rounds[f.ProviderID]
		current, ok := byProvider[f.ProviderID]
		if !ok {
			key := manualKey(round, f.HomeTeam, f.AwayTeam)
			current, ok = manual[key]
			delete(manual, key)
		}
		if !ok && !window.contains(firstKickoff[round]) {
			continue
		}
		if !ok {
			plan.Inserts = append(plan.Inserts, applyFeed(models.Match{
				ID:            uuid.New(),
				BolaoID:       bolaoID,
				CompetitionID: &competitionID,
			}, f, round))
			continue
		}
		if current.Locked {
			continue
		}
		if next := applyFeed(current, f, round); !sameMatch(current, next) {
			plan.Updates = append(plan.Updates, next)
		}
	}
	return plan
}

func NeedsResultsSync(matches []models.Match, now time.Time) bool {
	for _, m := range matches {
		if m.KickoffAt == nil || m.KickoffAt.After(now) || now.Sub(*m.KickoffAt) > resultsSyncWindow {
			continue
		}
		switch m.Status {
		case models.MatchStatusFinished, models.MatchStatusPostponed, models.MatchStatusCancelled:
			continue
		}
		return true
	}
	return false
}

func applyFeed(m models.Match, f FeedMatch, round int) models.Match {
	closeFollowsKickoff := m.MarketClosesAt == nil || (m.KickoffAt != nil && m.MarketClosesAt.Equal(*m.KickoffAt))
	status := feedStatuses[f.Status]
	if status == "" {
		status = models.MatchStatusScheduled
	}
	kickoff := f.Kickoff
	providerID := f.ProviderID

	m.ProviderMatchID = &providerID
	m.Round = round
	m.HomeTeam = f.HomeTeam
	m.AwayTeam = f.AwayTeam
	m.KickoffAt = &kickoff
	m.Status = status
	if closeFollowsKickoff {
		m.MarketClosesAt = nil
		if status != models.MatchStatusScheduled && status != models.MatchStatusPostponed && status != models.MatchStatusCancelled {
			m.MarketClosesAt = &kickoff
		}
	}
	if status == models.MatchStatusFinished && f.HomeGoals != nil && f.AwayGoals != nil {
		m.HomeGoals, m.AwayGoals = f.HomeGoals, f.AwayGoals
	}
	return m
}

func feedRounds(remote []FeedMatch) map[int64]int {
	rounds := make(map[int64]int, len(remote))
	legs := map[string][]FeedMatch{}
	for _, f := range remote {
		if _, knockout := knockoutFirstRound[f.Stage]; !knockout {
			rounds[f.ProviderID] = f.Matchday
			continue
		}
		key := f.Stage + "|" + pairKey(f.HomeTeam, f.AwayTeam)
		legs[key] = append(legs[key], f)
	}
	for _, tie := range legs {
		sort.Slice(tie, func(i, j int) bool { return tie[i].Kickoff.Before(tie[j].Kickoff) })
		for leg, f := range tie {
			rounds[f.ProviderID] = knockoutFirstRound[f.Stage] + leg
		}
	}
	return rounds
}

func pairKey(a, b string) string {
	if a > b {
		a, b = b, a
	}
	return a + "|" + b
}

func manualKey(round int, home, away string) string {
	return strconv.Itoa(round) + "|" + home + "|" + away
}

func sameMatch(a, b models.Match) bool {
	return a.Round == b.Round && a.HomeTeam == b.HomeTeam && a.AwayTeam == b.AwayTeam && a.Status == b.Status &&
		sameInt64(a.ProviderMatchID, b.ProviderMatchID) && sameTime(a.KickoffAt, b.KickoffAt) &&
		sameTime(a.MarketClosesAt, b.MarketClosesAt) && sameInt(a.HomeGoals, b.HomeGoals) && sameInt(a.AwayGoals, b.AwayGoals)
}

func sameTime(a, b *time.Time) bool {
	return (a == nil && b == nil) || (a != nil && b != nil && a.Equal(*b))
}

func sameInt(a, b *int) bool {
	return (a == nil && b == nil) || (a != nil && b != nil && *a == *b)
}

func sameInt64(a, b *int64) bool {
	return (a == nil && b == nil) || (a != nil && b != nil && *a == *b)
}
