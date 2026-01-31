package service

import "testing"

func TestCalculateRoundPoints(t *testing.T) {
	// User scenario: 2 exact (1-0, 0-1), 1 correct result only, 1 home goals only, 1 away goals only
	// Expected: 18+18+9+3+3 = 51 base, 2 types = 10 bonus, total 61
	preds := []struct{ PredHome, PredAway int }{
		{1, 0}, // exact 1-0
		{0, 1}, // exact 0-1
		{2, 1}, // correct result only (real 1-0)
		{1, 0}, // home only (real 1-2)
		{1, 1}, // away only (real 2-1)
	}
	matches := []struct{ HomeGoals, AwayGoals int }{
		{1, 0},
		{0, 1},
		{1, 0},
		{1, 2},
		{2, 1},
	}
	got, _, _ := CalculateRoundPoints(preds, matches, 0)
	if got != 61 {
		t.Errorf("CalculateRoundPoints = %d, want 61 (51 base + 10 bonus)", got)
	}
}

func TestCalculateMatchPoints(t *testing.T) {
	tests := []struct {
		predHome, predAway, realHome, realAway int
		want                                   int
	}{
		{1, 0, 1, 0, 18}, // exact score: 9+3+3+3
		{2, 1, 2, 1, 18}, // exact score
		{1, 0, 2, 0, 12}, // correct result+home goals: 9+3
		{0, 0, 1, 1, 12}, // draw correct only (empate vale 12)
		{1, 1, 1, 1, 21}, // exact draw (12+3+3+3)
		{2, 2, 3, 3, 12}, // correct result (draw), no goals, 4+ real but not exact
		{3, 3, 3, 3, 31}, // exact 4+ goals draw: 12+3+3+10+3
		{0, 0, 0, 0, 21}, // exact 0-0 (empate: 12+3+3+3)
		{1, 2, 1, 2, 18}, // exact 3 goals
	}
	for _, tt := range tests {
		got := CalculateMatchPoints(tt.predHome, tt.predAway, tt.realHome, tt.realAway)
		if got != tt.want {
			t.Errorf("CalculateMatchPoints(%d,%d,%d,%d) = %d, want %d",
				tt.predHome, tt.predAway, tt.realHome, tt.realAway, got, tt.want)
		}
	}
}
