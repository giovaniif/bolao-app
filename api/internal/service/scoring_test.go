package service

import "testing"

func TestCalculateRoundPointsTwoExactsResultHomeAndAwayOnly(t *testing.T) {
	preds := []struct{ PredHome, PredAway int }{
		{1, 0},
		{0, 1},
		{2, 1},
		{1, 0},
		{1, 1},
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

func TestCalculateRoundPointsRoundTotalBonusOnlyForCompleteRounds(t *testing.T) {
	preds := []PredEntry{{1, 0}, {0, 0}}
	matches := []MatchScore{{0, 1}, {0, 0}}

	withBonus, _, _ := CalculateRoundPoints(preds, matches, true)
	withoutBonus, _, _ := CalculateRoundPoints(preds, matches, false)

	if withBonus != withoutBonus+PointsRoundTotalGoals {
		t.Errorf("with bonus = %d, without = %d, want a %d difference",
			withBonus, withoutBonus, PointsRoundTotalGoals)
	}
}

func TestCalculateRoundPointsRoundTotalSumsBothSidesOfEachPrediction(t *testing.T) {
	tests := []struct {
		name      string
		preds     []PredEntry
		matches   []MatchScore
		wantBonus bool
	}{
		{"0x2 and 1x1 both total 2 goals", []PredEntry{{0, 2}}, []MatchScore{{1, 1}}, true},
		{"2x0 against 1x2 is 2 goals against 3", []PredEntry{{2, 0}}, []MatchScore{{1, 2}}, false},
	}
	for _, tt := range tests {
		withBonus, _, _ := CalculateRoundPoints(tt.preds, tt.matches, true)
		withoutBonus, _, _ := CalculateRoundPoints(tt.preds, tt.matches, false)
		if got := withBonus != withoutBonus; got != tt.wantBonus {
			t.Errorf("%s: bonus awarded = %v, want %v", tt.name, got, tt.wantBonus)
		}
	}
}

func TestCalculateRoundPointsMissingPredictionWithOpenMarketIsSkipped(t *testing.T) {
	preds := []PredEntry{{1, 0}, {noPredSentinel, noPredSentinel}}
	matches := []MatchScore{{1, 0}, {0, 0}}

	got, exact, correct := CalculateRoundPoints(preds, matches, true)
	if got != 28 || exact != 1 || correct != 1 {
		t.Errorf("CalculateRoundPoints = (%d,%d,%d), want (28,1,1)", got, exact, correct)
	}
}

func TestCalculateRoundPointsNoShowAddsScoreType(t *testing.T) {
	matches := []MatchScore{{1, 0}, {0, 0}}

	oneType := []PredEntry{{1, 0}, {noPredSentinel, noPredSentinel}}
	twoTypes := []PredEntry{{1, 0}, {0, 0}}

	before, _, _ := CalculateRoundPoints(oneType, matches, false)
	after, _, _ := CalculateRoundPoints(twoTypes, matches, false)

	if after-before != 28 {
		t.Errorf("filling the missing match changed the score by %d, want 28 (18 + 10 type bonus)",
			after-before)
	}
}

func TestCalculateMatchPoints(t *testing.T) {
	tests := []struct {
		name                                   string
		predHome, predAway, realHome, realAway int
		want                                   int
	}{
		{"exact score is result plus both goals plus exact", 1, 0, 1, 0, 18},
		{"exact score with three goals", 2, 1, 2, 1, 18},
		{"correct winner and home goals", 1, 0, 2, 0, 12},
		{"draw without the exact score is worth 12", 0, 0, 1, 1, 12},
		{"exact draw counts the result as 9, not 12", 1, 1, 1, 1, 18},
		{"draw in a 4+ goal match without the exact score", 2, 2, 3, 3, 12},
		{"exact score in a 4+ goal match adds 10 plus 3 for the total", 3, 3, 3, 3, 28},
		{"a match with exactly 4 goals already counts as 4+", 3, 1, 3, 1, 28},
		{"exact 0-0", 0, 0, 0, 0, 18},
		{"exact away win", 1, 2, 1, 2, 18},
		{"right total in a 4+ goal match without the exact score adds 3", 3, 1, 2, 2, 3},
		{"wrong winner and no goals right scores nothing", 0, 2, 1, 0, 0},
	}
	for _, tt := range tests {
		got := CalculateMatchPoints(tt.predHome, tt.predAway, tt.realHome, tt.realAway)
		if got != tt.want {
			t.Errorf("%s: CalculateMatchPoints(%d,%d,%d,%d) = %d, want %d",
				tt.name, tt.predHome, tt.predAway, tt.realHome, tt.realAway, got, tt.want)
		}
	}
}

func TestCalculateRoundPointsExactScoreTypeBonus(t *testing.T) {
	tests := []struct {
		name  string
		types []MatchScore
		want  int
	}{
		{"one exact-score type earns no bonus", []MatchScore{{1, 0}}, 0},
		{"two exact-score types earn 10", []MatchScore{{1, 0}, {0, 1}}, 10},
		{"three exact-score types earn 20", []MatchScore{{1, 0}, {0, 1}, {2, 1}}, 20},
		{"four exact-score types earn 30", []MatchScore{{1, 0}, {0, 1}, {2, 1}, {1, 2}}, 30},
		{"more than four types are capped at 30", []MatchScore{{1, 0}, {0, 1}, {2, 1}, {1, 2}, {3, 0}}, 30},
		{"the same score twice is one type", []MatchScore{{1, 0}, {1, 0}}, 0},
	}
	for _, tt := range tests {
		preds := make([]PredEntry, len(tt.types))
		base := 0
		for i, m := range tt.types {
			preds[i] = PredEntry{PredHome: m.HomeGoals, PredAway: m.AwayGoals}
			base += CalculateMatchPoints(m.HomeGoals, m.AwayGoals, m.HomeGoals, m.AwayGoals)
		}
		got, _, _ := CalculateRoundPoints(preds, tt.types, false)
		if got-base != tt.want {
			t.Errorf("%s: bonus = %d, want %d", tt.name, got-base, tt.want)
		}
	}
}
