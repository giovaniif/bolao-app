package service

import (
	"testing"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

func roundIntPtr(v int) *int { return &v }

// Fixed clock for the cases that depend on market_closes_at.
var roundNow = time.Date(2026, 5, 1, 12, 0, 0, 0, time.UTC)

// closesAt is relative to roundNow: negative has already closed, positive is still open.
func closesAt(d time.Duration) *time.Time {
	t := roundNow.Add(d)
	return &t
}

// played is a match with a result; scheduled is one still without.
func played(round int) models.Match {
	return models.Match{
		ID:        uuid.New(),
		Round:     round,
		HomeGoals: roundIntPtr(1),
		AwayGoals: roundIntPtr(0),
	}
}

func scheduled(round int) models.Match {
	return models.Match{ID: uuid.New(), Round: round}
}

func TestSummarizeRoundsActive(t *testing.T) {
	tests := []struct {
		name       string
		matches    []models.Match
		wantRounds []int
		wantActive int
	}{
		{
			name:       "no matches at all",
			matches:    nil,
			wantRounds: []int{},
			wantActive: 0,
		},
		{
			name:       "nothing finished yet, first round is active",
			matches:    []models.Match{scheduled(1), scheduled(1), scheduled(2)},
			wantRounds: []int{1, 2},
			wantActive: 1,
		},
		{
			name:       "round 1 done, round 2 is active",
			matches:    []models.Match{played(1), played(1), scheduled(2)},
			wantRounds: []int{1, 2},
			wantActive: 2,
		},
		{
			// The weekend case: round 2's market has closed and the games are being
			// played, but no results are in, so round 2 stays active.
			name:       "round partially filled in stays active",
			matches:    []models.Match{played(1), played(2), scheduled(2)},
			wantRounds: []int{1, 2},
			wantActive: 2,
		},
		{
			name:       "everything finished, stay on the last round",
			matches:    []models.Match{played(1), played(2), played(3)},
			wantRounds: []int{1, 2, 3},
			wantActive: 3,
		},
		{
			// Results filled out of order: round 2 is complete but round 1 is not. The
			// bolão has moved on, so the active round is the one after the latest done.
			name:       "results filled out of order",
			matches:    []models.Match{scheduled(1), played(2), scheduled(3)},
			wantRounds: []int{1, 2, 3},
			wantActive: 3,
		},
		{
			name:       "gap in the round numbers",
			matches:    []models.Match{played(1), scheduled(4)},
			wantRounds: []int{1, 4},
			wantActive: 4,
		},
		{
			name:       "single unfinished round",
			matches:    []models.Match{scheduled(7)},
			wantRounds: []int{7},
			wantActive: 7,
		},
		{
			name:       "single finished round",
			matches:    []models.Match{played(7)},
			wantRounds: []int{7},
			wantActive: 7,
		},
	}

	for _, tt := range tests {
		got := SummarizeRounds(tt.matches, roundNow)
		if got.Active != tt.wantActive {
			t.Errorf("%s: active = %d, want %d", tt.name, got.Active, tt.wantActive)
		}
		if len(got.Rounds) != len(tt.wantRounds) {
			t.Errorf("%s: rounds = %v, want %v", tt.name, got.Rounds, tt.wantRounds)
			continue
		}
		for i, r := range tt.wantRounds {
			if got.Rounds[i] != r {
				t.Errorf("%s: rounds = %v, want %v", tt.name, got.Rounds, tt.wantRounds)
				break
			}
		}
	}
}

// A round with a half-filled match (one goal column set, the other not) is not finished.
func TestSummarizeRoundsHalfFilledResult(t *testing.T) {
	half := models.Match{ID: uuid.New(), Round: 2, HomeGoals: roundIntPtr(1)}

	got := SummarizeRounds([]models.Match{played(1), half}, roundNow)
	if got.Active != 2 {
		t.Errorf("active = %d, want 2 (a half-filled result does not finish the round)", got.Active)
	}
}

// PendingResults is what the admin still owes: the market closed and no result was entered.
func TestSummarizeRoundsPendingResults(t *testing.T) {
	closed := func(round int) models.Match {
		m := scheduled(round)
		m.MarketClosesAt = closesAt(-time.Hour)
		return m
	}

	tests := []struct {
		name    string
		matches []models.Match
		want    int
	}{
		{"no matches", nil, 0},
		{"market closed, no result", []models.Match{closed(1)}, 1},
		{
			"market closed, result entered",
			[]models.Match{func() models.Match {
				m := played(1)
				m.MarketClosesAt = closesAt(-time.Hour)
				return m
			}()},
			0,
		},
		{
			"market still open",
			[]models.Match{func() models.Match {
				m := scheduled(1)
				m.MarketClosesAt = closesAt(time.Hour)
				return m
			}()},
			0,
		},
		// With no market_closes_at, nothing says the match should have been played yet.
		{"no market_closes_at", []models.Match{scheduled(1)}, 0},
		{
			"half-filled result counts as pending",
			[]models.Match{func() models.Match {
				m := closed(1)
				m.HomeGoals = roundIntPtr(1)
				return m
			}()},
			1,
		},
		{
			"mixed round",
			[]models.Match{closed(1), closed(1), closed(1), played(1), played(1)},
			3,
		},
	}

	for _, tt := range tests {
		if got := SummarizeRounds(tt.matches, roundNow); got.PendingResults != tt.want {
			t.Errorf("%s: pending = %d, want %d", tt.name, got.PendingResults, tt.want)
		}
	}
}

// Rounds must come back sorted even when the matches do not.
func TestSummarizeRoundsSortsRounds(t *testing.T) {
	got := SummarizeRounds([]models.Match{scheduled(3), played(1), scheduled(2)}, roundNow)

	want := []int{1, 2, 3}
	for i, r := range want {
		if got.Rounds[i] != r {
			t.Fatalf("rounds = %v, want %v", got.Rounds, want)
		}
	}
}
