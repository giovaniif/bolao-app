package service

import (
	"testing"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

func roundIntPtr(v int) *int { return &v }

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
		got := SummarizeRounds(tt.matches)
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

	got := SummarizeRounds([]models.Match{played(1), half})
	if got.Active != 2 {
		t.Errorf("active = %d, want 2 (a half-filled result does not finish the round)", got.Active)
	}
}

// Rounds must come back sorted even when the matches do not.
func TestSummarizeRoundsSortsRounds(t *testing.T) {
	got := SummarizeRounds([]models.Match{scheduled(3), played(1), scheduled(2)})

	want := []int{1, 2, 3}
	for i, r := range want {
		if got.Rounds[i] != r {
			t.Fatalf("rounds = %v, want %v", got.Rounds, want)
		}
	}
}
