package service

import (
	"testing"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

func liveFeed(id int64, status string, hg, ag *int) FeedMatch {
	f := feed(id, status, 31, "Flamengo", "Palmeiras")
	f.HomeGoals, f.AwayGoals = hg, ag
	return f
}

func goals(v int) *int { return &v }

func TestReconcileMatches_LivePartials(t *testing.T) {
	tests := []struct {
		name   string
		status string
		home   *int
		away   *int
		want   []models.LivePartial
	}{
		{name: "a match in play writes its current score as the partial", status: FeedStatusInPlay, home: goals(1), away: goals(0), want: []models.LivePartial{{HomeGoals: 1, AwayGoals: 0}}},
		{name: "a match at half time writes its current score as the partial", status: FeedStatusPaused, home: goals(2), away: goals(2), want: []models.LivePartial{{HomeGoals: 2, AwayGoals: 2}}},
		{name: "a live match without a score writes no partial", status: FeedStatusInPlay},
		{name: "a finished match writes no partial", status: FeedStatusFinished, home: goals(1), away: goals(0)},
		{name: "a match not started writes no partial", status: FeedStatusTimed},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := local(1, 31, "Flamengo", "Palmeiras")
			plan := ReconcileMatches(uuid.New(), uuid.New(), []models.Match{m}, []FeedMatch{liveFeed(1, tt.status, tt.home, tt.away)}, openWindow)
			if len(plan.Partials) != len(tt.want) {
				t.Fatalf("%s: partials = %+v, want %+v", tt.name, plan.Partials, tt.want)
			}
			for i, p := range plan.Partials {
				want := tt.want[i]
				want.MatchID = m.ID
				if p != want {
					t.Errorf("%s: partial = %+v, want %+v", tt.name, p, want)
				}
			}
		})
	}
}

func TestReconcileMatches_LivePartialOfANewMatchUsesTheInsertedID(t *testing.T) {
	plan := ReconcileMatches(uuid.New(), uuid.New(), nil, []FeedMatch{liveFeed(1, FeedStatusInPlay, goals(0), goals(1))}, openWindow)
	if len(plan.Inserts) != 1 || len(plan.Partials) != 1 {
		t.Fatalf("inserts = %d partials = %d, want 1 and 1", len(plan.Inserts), len(plan.Partials))
	}
	if plan.Partials[0].MatchID != plan.Inserts[0].ID {
		t.Errorf("partial match = %v, want inserted %v", plan.Partials[0].MatchID, plan.Inserts[0].ID)
	}
}

func TestReconcileMatches_LivePartialOfALockedMatchIsStillWritten(t *testing.T) {
	m := local(1, 31, "Flamengo", "Palmeiras")
	m.Locked = true
	plan := ReconcileMatches(uuid.New(), uuid.New(), []models.Match{m}, []FeedMatch{liveFeed(1, FeedStatusInPlay, goals(3), goals(1))}, openWindow)
	if len(plan.Partials) != 1 || plan.Partials[0].MatchID != m.ID {
		t.Errorf("partials = %+v, want one for the locked match", plan.Partials)
	}
}
