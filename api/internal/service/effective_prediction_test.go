package service

import (
	"testing"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

var testNow = time.Date(2026, 7, 27, 15, 0, 0, 0, time.UTC)

func matchClosingAt(closesAt *time.Time) models.Match {
	return models.Match{ID: uuid.New(), MarketClosesAt: closesAt}
}

func timePtr(t time.Time) *time.Time { return &t }

func TestMarketClosed(t *testing.T) {
	tests := []struct {
		name     string
		closesAt *time.Time
		want     bool
	}{
		{"no closing time set", nil, false},
		{"closes in an hour", timePtr(testNow.Add(time.Hour)), false},
		{"closes exactly now", timePtr(testNow), false}, // After is strict
		{"closed an hour ago", timePtr(testNow.Add(-time.Hour)), true},
	}
	for _, tt := range tests {
		if got := MarketClosed(matchClosingAt(tt.closesAt), testNow); got != tt.want {
			t.Errorf("MarketClosed(%s) = %v, want %v", tt.name, got, tt.want)
		}
	}
}

func TestEffectivePrediction(t *testing.T) {
	closed := timePtr(testNow.Add(-time.Hour))
	open := timePtr(testNow.Add(time.Hour))

	tests := []struct {
		name               string
		closesAt           *time.Time
		predHome, predAway int
		hasPred            bool
		wantHome, wantAway int
		wantCounts         bool
	}{
		{"stored prediction, market open", open, 2, 1, true, 2, 1, true},
		{"stored prediction, market closed", closed, 2, 1, true, 2, 1, true},
		{"no prediction, market closed becomes 0x0", closed, 0, 0, false, 0, 0, true},
		{"no prediction, market open does not count", open, 0, 0, false, 0, 0, false},
		// No closing time means the player can still bet, so no 0x0.
		{"no prediction, no closing time does not count", nil, 0, 0, false, 0, 0, false},
	}
	for _, tt := range tests {
		m := matchClosingAt(tt.closesAt)
		home, away, counts := EffectivePrediction(m, tt.predHome, tt.predAway, tt.hasPred, testNow)
		if home != tt.wantHome || away != tt.wantAway || counts != tt.wantCounts {
			t.Errorf("EffectivePrediction(%s) = (%d,%d,%v), want (%d,%d,%v)",
				tt.name, home, away, counts, tt.wantHome, tt.wantAway, tt.wantCounts)
		}
	}
}

func TestEffectivePredEntry(t *testing.T) {
	closed := matchClosingAt(timePtr(testNow.Add(-time.Hour)))
	open := matchClosingAt(timePtr(testNow.Add(time.Hour)))
	never := matchClosingAt(nil)

	if got := EffectivePredEntry(closed, 0, 0, false, testNow); got.PredHome != 0 || got.PredAway != 0 {
		t.Errorf("missing + closed = %v, want {0,0}", got)
	}
	if got := EffectivePredEntry(open, 0, 0, false, testNow); got.PredHome != noPredSentinel {
		t.Errorf("missing + open = %v, want sentinel", got)
	}
	if got := EffectivePredEntry(never, 0, 0, false, testNow); got.PredHome != noPredSentinel {
		t.Errorf("missing + no closing time = %v, want sentinel", got)
	}
	if got := EffectivePredEntry(closed, 3, 1, true, testNow); got.PredHome != 3 || got.PredAway != 1 {
		t.Errorf("stored prediction = %v, want {3,1}", got)
	}
}

// TestNoShowMatchPoints pins what a synthesized 0x0 is worth per match — this is what
// moves the standings once the rule ships.
func TestNoShowMatchPoints(t *testing.T) {
	tests := []struct {
		realHome, realAway int
		want               int
	}{
		{0, 0, 18}, // 9 result + 3 home + 3 away + 3 exact score
		{1, 1, 12}, // draw without the exact score
		{0, 1, 3},  // home goals only
		{2, 2, 12}, // draw without the score; 4 goals but wrong predicted total
		{2, 1, 0},
	}
	for _, tt := range tests {
		if got := CalculateMatchPoints(0, 0, tt.realHome, tt.realAway); got != tt.want {
			t.Errorf("0x0 against %d-%d = %d, want %d", tt.realHome, tt.realAway, got, tt.want)
		}
	}
}

func TestNoShowRoundScoring(t *testing.T) {
	closedMatches := []models.Match{
		matchClosingAt(timePtr(testNow.Add(-time.Hour))),
		matchClosingAt(timePtr(testNow.Add(-time.Hour))),
	}
	results := []MatchScore{{HomeGoals: 0, AwayGoals: 0}, {HomeGoals: 0, AwayGoals: 1}}

	var preds []PredEntry
	for _, m := range closedMatches {
		preds = append(preds, EffectivePredEntry(m, 0, 0, false, testNow))
	}
	points, exact, correct := CalculateRoundPoints(preds, results, true)
	// 18 + 3. No round-total bonus (0 predicted vs 1 actual) and a single exact-score
	// type, which is worth 0.
	if points != 21 || exact != 1 || correct != 1 {
		t.Errorf("closed round with no predictions = (%d,%d,%d), want (21,1,1)", points, exact, correct)
	}

	openMatches := []models.Match{matchClosingAt(nil), matchClosingAt(nil)}
	preds = nil
	for _, m := range openMatches {
		preds = append(preds, EffectivePredEntry(m, 0, 0, false, testNow))
	}
	points, exact, correct = CalculateRoundPoints(preds, results, true)
	if points != 0 || exact != 0 || correct != 0 {
		t.Errorf("open round with no predictions = (%d,%d,%d), want (0,0,0)", points, exact, correct)
	}
}

// TestRoundTotalBonusNeedsAtLeastOnePrediction covers the bug where an all-0-0 round
// handed the 10-point round-total bonus to someone who predicted nothing: roundPredTotal
// (0) matched actualRoundTotal (0).
func TestRoundTotalBonusNeedsAtLeastOnePrediction(t *testing.T) {
	preds := []PredEntry{
		{PredHome: noPredSentinel, PredAway: noPredSentinel},
		{PredHome: noPredSentinel, PredAway: noPredSentinel},
	}
	results := []MatchScore{{HomeGoals: 0, AwayGoals: 0}, {HomeGoals: 0, AwayGoals: 0}}
	if points, _, _ := CalculateRoundPoints(preds, results, true); points != 0 {
		t.Errorf("total no-show on an all-0-0 round = %d points, want 0", points)
	}
}

func TestFillMissingPredictions(t *testing.T) {
	userID := uuid.New()
	closed := matchClosingAt(timePtr(testNow.Add(-time.Hour)))
	open := matchClosingAt(timePtr(testNow.Add(time.Hour)))
	never := matchClosingAt(nil)
	answered := matchClosingAt(timePtr(testNow.Add(-time.Hour)))

	stored := models.Prediction{
		ID: uuid.New(), UserID: userID, MatchID: answered.ID, HomeGoals: 3, AwayGoals: 1,
	}

	got := FillMissingPredictions(
		[]models.Match{answered, closed, open, never},
		userID,
		[]models.Prediction{stored},
		testNow,
	)

	if len(got) != 2 {
		t.Fatalf("FillMissingPredictions returned %d entries, want 2: %+v", len(got), got)
	}
	if got[0].MatchID != answered.ID || got[0].HomeGoals != 3 || got[0].AwayGoals != 1 || got[0].AutoFilled {
		t.Errorf("stored prediction was altered: %+v", got[0])
	}
	if got[1].MatchID != closed.ID || got[1].HomeGoals != 0 || got[1].AwayGoals != 0 || !got[1].AutoFilled {
		t.Errorf("closed match with no prediction = %+v, want 0x0 AutoFilled", got[1])
	}
	if got[1].ID != uuid.Nil {
		t.Errorf("synthesized prediction should have no row ID, got %v", got[1].ID)
	}
	if got[1].UserID != userID {
		t.Errorf("synthesized prediction has wrong UserID: %v", got[1].UserID)
	}
}

func TestFillMissingPredictionsNeverNil(t *testing.T) {
	got := FillMissingPredictions(nil, uuid.New(), nil, testNow)
	if got == nil {
		t.Error("returned nil; the handler relies on a non-nil slice to serialize []")
	}
}
