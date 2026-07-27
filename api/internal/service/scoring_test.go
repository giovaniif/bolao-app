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
	got, _, _ := CalculateRoundPoints(preds, matches, true)
	if got != 61 {
		t.Errorf("CalculateRoundPoints = %d, want 61 (51 base + 10 bonus)", got)
	}
}

// The counted > 0 guard must not cost a real player the round-total bonus: predicted
// total 1 against an actual total of 1, so the 10 points still apply.
func TestCalculateRoundPointsAwardsRoundTotalBonus(t *testing.T) {
	preds := []PredEntry{{1, 0}, {0, 0}}
	matches := []MatchScore{{0, 1}, {0, 0}}

	withBonus, _, _ := CalculateRoundPoints(preds, matches, true)
	withoutBonus, _, _ := CalculateRoundPoints(preds, matches, false)

	if withBonus != withoutBonus+PointsRoundTotalGoals {
		t.Errorf("with bonus = %d, without = %d, want a %d difference",
			withBonus, withoutBonus, PointsRoundTotalGoals)
	}
}

// Sentinel entries must not contribute to the predicted goal total. Here the only real
// prediction totals 1 goal against an actual total of 1, so the bonus applies even though
// a skipped match sits alongside it.
func TestCalculateRoundPointsSentinelIgnoredInRoundTotal(t *testing.T) {
	preds := []PredEntry{{1, 0}, {noPredSentinel, noPredSentinel}}
	matches := []MatchScore{{1, 0}, {0, 0}}

	got, exact, correct := CalculateRoundPoints(preds, matches, true)
	// 18 for the exact 1-0 + 10 round total. The skipped match scores nothing and is not
	// counted as an exact score or a correct result.
	if got != 28 || exact != 1 || correct != 1 {
		t.Errorf("CalculateRoundPoints = (%d,%d,%d), want (28,1,1)", got, exact, correct)
	}
}

// A synthesized 0×0 registers the "0-0" score type, which can lift a player from one type
// (0 bonus) to two (+10). This is the least obvious way the new rule moves the standings.
func TestCalculateRoundPointsNoShowAddsScoreType(t *testing.T) {
	matches := []MatchScore{{1, 0}, {0, 0}}

	oneType := []PredEntry{{1, 0}, {noPredSentinel, noPredSentinel}}
	twoTypes := []PredEntry{{1, 0}, {0, 0}}

	before, _, _ := CalculateRoundPoints(oneType, matches, false)
	after, _, _ := CalculateRoundPoints(twoTypes, matches, false)

	// The extra match is worth 18 on its own, plus the 10-point bonus for a second
	// distinct exact-score type.
	if after-before != 28 {
		t.Errorf("filling the missing match changed the score by %d, want 28 (18 + 10 type bonus)",
			after-before)
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
		{0, 0, 1, 1, 12}, // draw without exact (empate sem acerto = 12)
		{1, 1, 1, 1, 18}, // exact draw (9+3+3+3, empate exato usa 9)
		{2, 2, 3, 3, 12}, // correct result (draw), no goals, 4+ real but not exact
		{3, 3, 3, 3, 28}, // exact 4+ goals: 9+3+3+10+3 (planilha: O=18 + P=10; total gols também +3)
		{0, 0, 0, 0, 18}, // exact 0-0 (9+3+3+3)
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
