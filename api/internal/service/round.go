package service

import (
	"sort"
	"time"

	"github.com/bolao-app/api/internal/models"
)

type RoundsSummary struct {
	Rounds         []int `json:"rounds"`
	Active         int   `json:"active"`
	PendingResults int   `json:"pending_results"`
}

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
