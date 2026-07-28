package service

import (
	"sort"
	"time"

	"github.com/bolao-app/api/internal/models"
)

// RoundsSummary is what the UI needs to pick a default round: every round that exists,
// plus the one to select when the user has not asked for a specific one.
type RoundsSummary struct {
	Rounds []int `json:"rounds"`
	Active int   `json:"active"`
	// PendingResults counts matches whose market has already closed but whose result has
	// not been entered — what the admin still owes the bolão. Matches without a
	// market_closes_at are excluded: nothing says they should have been played yet.
	//
	// Deliberately different from the unresolved count in BolaoService.FinishActive, which
	// ignores market_closes_at because finishing a bolão needs every match resolved.
	PendingResults int `json:"pending_results"`
}

// SummarizeRounds lists the rounds of a bolão and picks the active one: the first round
// after the latest finished one, where a round is finished once every match in it has a
// result. Falls back to the last round when they are all finished, and to the first round
// when none is.
//
// now is a parameter rather than a time.Now() call so PendingResults stays testable, the
// same way scoreParticipantRound takes it.
func SummarizeRounds(matches []models.Match, now time.Time) RoundsSummary {
	finished := make(map[int]bool)
	pending := 0
	for _, m := range matches {
		if _, seen := finished[m.Round]; !seen {
			finished[m.Round] = true
		}
		if m.HomeGoals == nil || m.AwayGoals == nil {
			finished[m.Round] = false
			if m.MarketClosesAt != nil && m.MarketClosesAt.Before(now) {
				pending++
			}
		}
	}

	rounds := make([]int, 0, len(finished))
	for round := range finished {
		rounds = append(rounds, round)
	}
	sort.Ints(rounds)

	if len(rounds) == 0 {
		return RoundsSummary{Rounds: []int{}, Active: 0, PendingResults: 0}
	}

	// Latest finished round, then the first round after it. Scanning for the *latest*
	// rather than the first unfinished round matters when results are filled out of order:
	// an admin who completes round 4 before round 3 has moved the bolão on to round 5.
	latestFinished := 0
	for _, round := range rounds {
		if finished[round] {
			latestFinished = round
		}
	}

	active := rounds[len(rounds)-1]
	for _, round := range rounds {
		if round > latestFinished {
			active = round
			break
		}
	}

	return RoundsSummary{Rounds: rounds, Active: active, PendingResults: pending}
}
