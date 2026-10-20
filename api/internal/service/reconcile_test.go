package service

import (
	"testing"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

var feedKickoff = time.Date(2026, 10, 25, 19, 0, 0, 0, time.UTC)

func feed(id int64, status string, matchday int, home, away string) FeedMatch {
	return FeedMatch{ProviderID: id, Kickoff: feedKickoff, Status: status, Stage: StageRegularSeason, Matchday: matchday, HomeTeam: home, AwayTeam: away}
}

func finishedFeed(id int64, home, away string, hg, ag int) FeedMatch {
	f := feed(id, FeedStatusFinished, 31, home, away)
	f.HomeGoals, f.AwayGoals = &hg, &ag
	return f
}

func providerID(v int64) *int64 { return &v }

var openWindow = InsertWindow{From: feedKickoff.Add(-365 * 24 * time.Hour), To: feedKickoff.Add(365 * 24 * time.Hour)}

func local(id int64, round int, home, away string) models.Match {
	k := feedKickoff
	return models.Match{ID: uuid.New(), ProviderMatchID: providerID(id), Round: round, HomeTeam: home, AwayTeam: away, KickoffAt: &k, MarketClosesAt: &k, Status: models.MatchStatusTimed}
}

func TestReconcileMatches(t *testing.T) {
	competition := uuid.New()
	bolao := uuid.New()
	moved := feedKickoff.Add(24 * time.Hour)
	custom := feedKickoff.Add(-2 * time.Hour)

	tests := []struct {
		name   string
		local  []models.Match
		remote []FeedMatch
		check  func(t *testing.T, plan ReconcilePlan)
	}{
		{
			name:   "a new fixture is inserted with its round and a close at kickoff",
			remote: []FeedMatch{feed(1, FeedStatusTimed, 32, "Flamengo", "Palmeiras")},
			check: func(t *testing.T, plan ReconcilePlan) {
				if len(plan.Inserts) != 1 {
					t.Fatalf("inserts = %d, want 1", len(plan.Inserts))
				}
				m := plan.Inserts[0]
				if m.Round != 32 || m.HomeTeam != "Flamengo" || m.CompetitionID == nil || *m.CompetitionID != competition || m.BolaoID != bolao {
					t.Errorf("insert = %+v, want round 32 Flamengo in the competition and bolão", m)
				}
				if m.MarketClosesAt == nil || !m.MarketClosesAt.Equal(feedKickoff) || m.Status != models.MatchStatusTimed {
					t.Errorf("close = %v status = %q, want kickoff and timed", m.MarketClosesAt, m.Status)
				}
			},
		},
		{
			name:   "a fixture with only a date has no close time yet",
			remote: []FeedMatch{feed(1, FeedStatusScheduled, 35, "Santos", "Remo")},
			check: func(t *testing.T, plan ReconcilePlan) {
				if len(plan.Inserts) != 1 || plan.Inserts[0].MarketClosesAt != nil || plan.Inserts[0].Status != models.MatchStatusScheduled {
					t.Errorf("inserts = %+v, want one scheduled match with no close", plan.Inserts)
				}
			},
		},
		{
			name:   "an unchanged match is not updated",
			local:  []models.Match{local(1, 32, "Flamengo", "Palmeiras")},
			remote: []FeedMatch{feed(1, FeedStatusTimed, 32, "Flamengo", "Palmeiras")},
			check: func(t *testing.T, plan ReconcilePlan) {
				if len(plan.Inserts)+len(plan.Updates) != 0 {
					t.Errorf("plan = %+v, want no changes", plan)
				}
			},
		},
		{
			name:  "a moved kickoff moves a close that followed the kickoff",
			local: []models.Match{local(1, 32, "Flamengo", "Palmeiras")},
			remote: func() []FeedMatch {
				f := feed(1, FeedStatusTimed, 32, "Flamengo", "Palmeiras")
				f.Kickoff = moved
				return []FeedMatch{f}
			}(),
			check: func(t *testing.T, plan ReconcilePlan) {
				if len(plan.Updates) != 1 || !plan.Updates[0].KickoffAt.Equal(moved) || !plan.Updates[0].MarketClosesAt.Equal(moved) {
					t.Errorf("updates = %+v, want kickoff and close at %v", plan.Updates, moved)
				}
			},
		},
		{
			name: "a moved kickoff keeps a close that an admin set",
			local: func() []models.Match {
				m := local(1, 32, "Flamengo", "Palmeiras")
				m.MarketClosesAt = &custom
				return []models.Match{m}
			}(),
			remote: func() []FeedMatch {
				f := feed(1, FeedStatusTimed, 32, "Flamengo", "Palmeiras")
				f.Kickoff = moved
				return []FeedMatch{f}
			}(),
			check: func(t *testing.T, plan ReconcilePlan) {
				if len(plan.Updates) != 1 || !plan.Updates[0].MarketClosesAt.Equal(custom) {
					t.Errorf("updates = %+v, want the admin close %v", plan.Updates, custom)
				}
			},
		},
		{
			name:   "a final score is written and the match is finished",
			local:  []models.Match{local(1, 31, "Corinthians", "Vitória")},
			remote: []FeedMatch{finishedFeed(1, "Corinthians", "Vitória", 1, 1)},
			check: func(t *testing.T, plan ReconcilePlan) {
				if len(plan.Updates) != 1 {
					t.Fatalf("updates = %d, want 1", len(plan.Updates))
				}
				m := plan.Updates[0]
				if m.Status != models.MatchStatusFinished || m.HomeGoals == nil || *m.HomeGoals != 1 || *m.AwayGoals != 1 {
					t.Errorf("update = %+v, want finished 1 x 1", m)
				}
			},
		},
		{
			name: "a corrected score replaces the old one",
			local: func() []models.Match {
				m := local(1, 31, "Corinthians", "Vitória")
				m.Status = models.MatchStatusFinished
				m.HomeGoals, m.AwayGoals = roundIntPtr(2), roundIntPtr(1)
				return []models.Match{m}
			}(),
			remote: []FeedMatch{finishedFeed(1, "Corinthians", "Vitória", 1, 1)},
			check: func(t *testing.T, plan ReconcilePlan) {
				if len(plan.Updates) != 1 || *plan.Updates[0].HomeGoals != 1 {
					t.Errorf("updates = %+v, want 1 x 1", plan.Updates)
				}
			},
		},
		{
			name:  "a live score is not a result",
			local: []models.Match{local(1, 31, "Corinthians", "Vitória")},
			remote: func() []FeedMatch {
				f := finishedFeed(1, "Corinthians", "Vitória", 1, 0)
				f.Status = FeedStatusInPlay
				return []FeedMatch{f}
			}(),
			check: func(t *testing.T, plan ReconcilePlan) {
				if len(plan.Updates) != 1 || plan.Updates[0].HomeGoals != nil || plan.Updates[0].Status != models.MatchStatusLive {
					t.Errorf("updates = %+v, want live with no result", plan.Updates)
				}
			},
		},
		{
			name:   "a postponed match opens its market again",
			local:  []models.Match{local(1, 21, "Chapecoense", "Bahia")},
			remote: []FeedMatch{feed(1, FeedStatusPostponed, 21, "Chapecoense", "Bahia")},
			check: func(t *testing.T, plan ReconcilePlan) {
				if len(plan.Updates) != 1 || plan.Updates[0].Status != models.MatchStatusPostponed || plan.Updates[0].MarketClosesAt != nil {
					t.Errorf("updates = %+v, want postponed with no close", plan.Updates)
				}
			},
		},
		{
			name: "a locked match is never changed",
			local: func() []models.Match {
				m := local(1, 31, "Corinthians", "Vitória")
				m.Locked = true
				return []models.Match{m}
			}(),
			remote: []FeedMatch{finishedFeed(1, "Corinthians", "Vitória", 3, 0)},
			check: func(t *testing.T, plan ReconcilePlan) {
				if len(plan.Updates)+len(plan.Inserts) != 0 {
					t.Errorf("plan = %+v, want no changes", plan)
				}
			},
		},
		{
			name: "a manual match is linked by round and teams",
			local: func() []models.Match {
				m := local(0, 31, "Corinthians", "Vitória")
				m.ProviderMatchID = nil
				return []models.Match{m}
			}(),
			remote: []FeedMatch{finishedFeed(9, "Corinthians", "Vitória", 1, 1)},
			check: func(t *testing.T, plan ReconcilePlan) {
				if len(plan.Inserts) != 0 || len(plan.Updates) != 1 || plan.Updates[0].ProviderMatchID == nil || *plan.Updates[0].ProviderMatchID != 9 {
					t.Errorf("plan = %+v, want one update linked to provider id 9", plan)
				}
			},
		},
		{
			name:  "a Champions League knockout appears mid-season with its own rounds per leg",
			local: []models.Match{local(1, 8, "Arsenal", "Inter")},
			remote: func() []FeedMatch {
				league := feed(1, FeedStatusTimed, 8, "Arsenal", "Inter")
				first := FeedMatch{ProviderID: 2, Kickoff: feedKickoff.Add(30 * 24 * time.Hour), Status: FeedStatusTimed, Stage: StageLast16, HomeTeam: "Inter", AwayTeam: "Real Madrid"}
				second := FeedMatch{ProviderID: 3, Kickoff: feedKickoff.Add(37 * 24 * time.Hour), Status: FeedStatusTimed, Stage: StageLast16, HomeTeam: "Real Madrid", AwayTeam: "Inter"}
				return []FeedMatch{league, second, first}
			}(),
			check: func(t *testing.T, plan ReconcilePlan) {
				rounds := map[int64]int{}
				for _, m := range plan.Inserts {
					rounds[*m.ProviderMatchID] = m.Round
				}
				if rounds[2] != 11 || rounds[3] != 12 {
					t.Errorf("knockout rounds = %v, want 2→11 and 3→12", rounds)
				}
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.check(t, ReconcileMatches(competition, bolao, tt.local, tt.remote, openWindow))
		})
	}
}

func TestReconcileMatches_InsertsOnlyInsideTheWindow(t *testing.T) {
	window := InsertWindow{From: feedKickoff.Add(-24 * time.Hour), To: feedKickoff.Add(14 * 24 * time.Hour)}
	before := feed(1, FeedStatusFinished, 1, "Bahia", "Santos")
	before.Kickoff = feedKickoff.Add(-48 * time.Hour)
	inside := feed(2, FeedStatusTimed, 32, "Flamengo", "Palmeiras")
	after := feed(3, FeedStatusTimed, 36, "Grêmio", "Inter")
	after.Kickoff = feedKickoff.Add(20 * 24 * time.Hour)
	tracked := local(4, 30, "Remo", "Bahia")
	movedOut := feed(4, FeedStatusTimed, 30, "Remo", "Bahia")
	movedOut.Kickoff = feedKickoff.Add(30 * 24 * time.Hour)

	plan := ReconcileMatches(uuid.New(), uuid.New(), []models.Match{tracked}, []FeedMatch{before, inside, after, movedOut}, window)

	if len(plan.Inserts) != 1 || *plan.Inserts[0].ProviderMatchID != 2 {
		t.Errorf("inserts = %+v, want only provider match 2", plan.Inserts)
	}
	if len(plan.Updates) != 1 || *plan.Updates[0].ProviderMatchID != 4 {
		t.Errorf("updates = %+v, want the tracked match even outside the window", plan.Updates)
	}
}

func TestReconcileMatches_InsertsARoundWholeWhenItsFirstKickoffIsInsideTheWindow(t *testing.T) {
	window := InsertWindow{From: feedKickoff.Add(-24 * time.Hour), To: feedKickoff.Add(14 * 24 * time.Hour)}
	first := feed(1, FeedStatusTimed, 34, "Bahia", "Santos")
	first.Kickoff = window.To.Add(-time.Hour)
	last := feed(2, FeedStatusTimed, 34, "Flamengo", "Palmeiras")
	last.Kickoff = window.To.Add(48 * time.Hour)

	plan := ReconcileMatches(uuid.New(), uuid.New(), nil, []FeedMatch{last, first}, window)

	if len(plan.Inserts) != 2 {
		t.Errorf("inserts = %d, want the whole round 34", len(plan.Inserts))
	}
}

func TestNeedsResultsSync(t *testing.T) {
	now := feedKickoff
	at := func(d time.Duration, status string) models.Match {
		k := now.Add(d)
		return models.Match{KickoffAt: &k, Status: status}
	}
	tests := []struct {
		name    string
		matches []models.Match
		want    bool
	}{
		{"no match has started", []models.Match{at(time.Hour, models.MatchStatusTimed)}, false},
		{"a match is live", []models.Match{at(-time.Hour, models.MatchStatusLive)}, true},
		{"a match started and has no final yet", []models.Match{at(-30*time.Minute, models.MatchStatusTimed)}, true},
		{"a match is still unfinished hours after kickoff", []models.Match{at(-5*time.Hour, models.MatchStatusTimed)}, true},
		{"every started match is finished", []models.Match{at(-3*time.Hour, models.MatchStatusFinished)}, false},
		{"a postponed match does not need results", []models.Match{at(-3*time.Hour, models.MatchStatusPostponed)}, false},
		{"an unfinished match older than a day waits for the daily sync", []models.Match{at(-25*time.Hour, models.MatchStatusTimed)}, false},
		{"a manual match without a kickoff is ignored", []models.Match{{Status: models.MatchStatusScheduled}}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := NeedsResultsSync(tt.matches, now); got != tt.want {
				t.Errorf("NeedsResultsSync = %v, want %v", got, tt.want)
			}
		})
	}
}
