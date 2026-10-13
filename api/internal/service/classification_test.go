package service

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func closedResult(homeGoals, awayGoals int) matchWithResult {
	return matchWithResult{
		m:    matchClosingAt(timePtr(testNow.Add(-time.Hour))),
		home: homeGoals,
		away: awayGoals,
	}
}

func openResult(homeGoals, awayGoals int) matchWithResult {
	return matchWithResult{m: matchClosingAt(nil), home: homeGoals, away: awayGoals}
}

func noPredictions(uuid.UUID) (int, int, bool) { return 0, 0, false }

func predictions(matches []matchWithResult, preds map[int][2]int) func(uuid.UUID) (int, int, bool) {
	byID := make(map[uuid.UUID][2]int, len(preds))
	for i, p := range preds {
		byID[matches[i].m.ID] = p
	}
	return func(matchID uuid.UUID) (int, int, bool) {
		p, ok := byID[matchID]
		if !ok {
			return 0, 0, false
		}
		return p[0], p[1], true
	}
}

func TestScoreParticipantRoundNoShowAfterClose(t *testing.T) {
	matches := []matchWithResult{closedResult(0, 0), closedResult(0, 1)}

	got := scoreParticipantRound(matches, noPredictions, true, testNow)
	if got.points != 21 || got.exactScores != 1 || got.correctResults != 1 {
		t.Errorf("no-show on a closed round = %+v, want {21 1 1}", got)
	}
}

func TestScoreParticipantRoundNoShowOpenMarket(t *testing.T) {
	matches := []matchWithResult{openResult(0, 0), openResult(0, 1)}

	got := scoreParticipantRound(matches, noPredictions, true, testNow)
	if got.points != 0 || got.exactScores != 0 || got.correctResults != 0 {
		t.Errorf("no-show while the market is open = %+v, want all zero", got)
	}
}

func TestScoreParticipantRoundSkippedClosedMatchIs0x0AndSkippedOpenMatchIsIgnored(t *testing.T) {
	matches := []matchWithResult{
		closedResult(2, 1),
		closedResult(0, 0),
		openResult(3, 0),
	}
	lookup := predictions(matches, map[int][2]int{0: {2, 1}})

	got := scoreParticipantRound(matches, lookup, true, testNow)
	if got.points != 46 || got.exactScores != 2 || got.correctResults != 2 {
		t.Errorf("partially filled round = %+v, want {46 2 2}", got)
	}
}

func TestScoreParticipantRoundPartialsSkipRoundTotalBonus(t *testing.T) {
	matches := []matchWithResult{closedResult(1, 0)}
	lookup := predictions(matches, map[int][2]int{0: {1, 0}})

	final := scoreParticipantRound(matches, lookup, true, testNow)
	partial := scoreParticipantRound(matches, lookup, false, testNow)

	if final.points != partial.points+PointsRoundTotalGoals {
		t.Errorf("final=%d partial=%d, want the final to be exactly %d higher",
			final.points, partial.points, PointsRoundTotalGoals)
	}
}

func TestPickRoundWinnerHighestPoints(t *testing.T) {
	ana, bruno := uuid.New(), uuid.New()
	scores := map[uuid.UUID]roundScore{
		ana:   {points: 30, exactScores: 1, correctResults: 2},
		bruno: {points: 21, exactScores: 2, correctResults: 2},
	}

	winner, ok := pickRoundWinner(scores)
	if !ok || winner != ana {
		t.Errorf("winner = %v (ok=%v), want Ana on points", winner, ok)
	}
}

func TestPickRoundWinnerTiebreakers(t *testing.T) {
	ana, bruno := uuid.New(), uuid.New()

	winner, ok := pickRoundWinner(map[uuid.UUID]roundScore{
		ana:   {points: 21, exactScores: 1, correctResults: 3},
		bruno: {points: 21, exactScores: 2, correctResults: 1},
	})
	if !ok || winner != bruno {
		t.Errorf("winner = %v (ok=%v), want Bruno on exact scores", winner, ok)
	}

	winner, ok = pickRoundWinner(map[uuid.UUID]roundScore{
		ana:   {points: 21, exactScores: 1, correctResults: 3},
		bruno: {points: 21, exactScores: 1, correctResults: 1},
	})
	if !ok || winner != ana {
		t.Errorf("winner = %v (ok=%v), want Ana on correct results", winner, ok)
	}
}

func TestPickRoundWinnerFullTieFallsBackToUserID(t *testing.T) {
	tied := roundScore{points: 21, exactScores: 1, correctResults: 1}
	scores := map[uuid.UUID]roundScore{}
	for range 8 {
		scores[uuid.New()] = tied
	}

	first, ok := pickRoundWinner(scores)
	if !ok {
		t.Fatal("a fully tied round produced no winner")
	}
	for i := range 200 {
		got, _ := pickRoundWinner(scores)
		if got != first {
			t.Fatalf("call %d returned %v, first call returned %v — winner is not deterministic", i, got, first)
		}
	}
}

func TestPickRoundWinnerNobodyScored(t *testing.T) {
	ana, bruno := uuid.New(), uuid.New()
	scores := map[uuid.UUID]roundScore{
		ana:   {points: 0},
		bruno: {points: 0},
	}

	if winner, ok := pickRoundWinner(scores); ok {
		t.Errorf("a round nobody scored in produced winner %v, want none", winner)
	}
}

func TestPickRoundWinnerEmpty(t *testing.T) {
	if _, ok := pickRoundWinner(map[uuid.UUID]roundScore{}); ok {
		t.Error("empty round produced a winner, want none")
	}
}

func TestPickRoundWinnerNoShowCanWin(t *testing.T) {
	matches := []matchWithResult{closedResult(0, 0), closedResult(1, 1)}
	absent, present := uuid.New(), uuid.New()

	absentScore := scoreParticipantRound(matches, noPredictions, true, testNow)
	presentScore := scoreParticipantRound(matches, predictions(matches, map[int][2]int{
		0: {3, 2},
		1: {4, 0},
	}), true, testNow)

	if absentScore.points == 0 {
		t.Fatal("the no-show scored nothing; this test no longer covers what it claims")
	}
	if presentScore.points >= absentScore.points {
		t.Fatalf("the player who did submit scored %d vs the no-show's %d; pick worse predictions",
			presentScore.points, absentScore.points)
	}

	winner, ok := pickRoundWinner(map[uuid.UUID]roundScore{
		absent:  absentScore,
		present: presentScore,
	})
	if !ok || winner != absent {
		t.Errorf("winner = %v (ok=%v), want the no-show to win the round", winner, ok)
	}
}
