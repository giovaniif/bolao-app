package service

import (
	"testing"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

func TestRevealedPredictionsHidesEveryMatchWhileNoMarketClosed(t *testing.T) {
	user := uuid.New()
	open := matchClosingAt(timePtr(testNow.Add(time.Hour)))
	undated := matchClosingAt(nil)
	stored := []models.Prediction{{UserID: user, MatchID: open.ID, HomeGoals: 2, AwayGoals: 1}}

	got, revealed := RevealedPredictions([]models.Match{open, undated}, user, stored, testNow)

	if revealed {
		t.Fatal("revealed = true, want false while no market closed")
	}
	if len(got) != 0 {
		t.Fatalf("got %d predictions, want none", len(got))
	}
}

func TestRevealedPredictionsHidesNothingForAnEmptyRound(t *testing.T) {
	got, revealed := RevealedPredictions(nil, uuid.New(), nil, testNow)

	if revealed {
		t.Fatal("revealed = true, want false for a round without matches")
	}
	if got == nil || len(got) != 0 {
		t.Fatalf("got %v, want an empty non-nil slice", got)
	}
}

func TestRevealedPredictionsShowsOnlyMatchesWhoseMarketClosed(t *testing.T) {
	user := uuid.New()
	closedWithPick := matchClosingAt(timePtr(testNow.Add(-72 * time.Hour)))
	closedWithoutPick := matchClosingAt(timePtr(testNow.Add(-time.Minute)))
	openWithPick := matchClosingAt(timePtr(testNow.Add(time.Hour)))
	undatedWithPick := matchClosingAt(nil)
	stored := []models.Prediction{
		{UserID: user, MatchID: closedWithPick.ID, HomeGoals: 3, AwayGoals: 0},
		{UserID: user, MatchID: openWithPick.ID, HomeGoals: 1, AwayGoals: 1},
		{UserID: user, MatchID: undatedWithPick.ID, HomeGoals: 2, AwayGoals: 2},
	}
	matches := []models.Match{closedWithPick, openWithPick, closedWithoutPick, undatedWithPick}

	got, revealed := RevealedPredictions(matches, user, stored, testNow)

	if !revealed {
		t.Fatal("revealed = false, want true once one market closed")
	}
	if len(got) != 2 {
		t.Fatalf("got %d predictions, want 2: %+v", len(got), got)
	}
	if got[0].MatchID != closedWithPick.ID || got[0].HomeGoals != 3 || got[0].AwayGoals != 0 || got[0].AutoFilled {
		t.Errorf("first = %+v, want the stored 3x0 of the closed match", got[0])
	}
	if got[1].MatchID != closedWithoutPick.ID || got[1].HomeGoals != 0 || got[1].AwayGoals != 0 || !got[1].AutoFilled || got[1].UserID != user {
		t.Errorf("second = %+v, want an auto-filled 0x0 for the closed match without a pick", got[1])
	}
}

func TestRevealedPredictionsShowsTheWholeRoundOnceEveryMarketClosed(t *testing.T) {
	user := uuid.New()
	first := matchClosingAt(timePtr(testNow.Add(-2 * time.Hour)))
	second := matchClosingAt(timePtr(testNow.Add(-time.Hour)))
	stored := []models.Prediction{
		{UserID: user, MatchID: first.ID, HomeGoals: 1, AwayGoals: 0},
		{UserID: user, MatchID: second.ID, HomeGoals: 0, AwayGoals: 2},
	}

	got, revealed := RevealedPredictions([]models.Match{first, second}, user, stored, testNow)

	if !revealed || len(got) != 2 {
		t.Fatalf("got (%+v, %v), want both predictions revealed", got, revealed)
	}
}
