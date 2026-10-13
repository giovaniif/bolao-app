package service

import (
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

type PredEntry = struct{ PredHome, PredAway int }
type MatchScore = struct{ HomeGoals, AwayGoals int }

const noPredSentinel = -1

func MarketClosed(m models.Match, now time.Time) bool {
	return m.MarketClosesAt != nil && now.After(*m.MarketClosesAt)
}

func EffectivePrediction(m models.Match, predHome, predAway int, hasPred bool, now time.Time) (home, away int, counts bool) {
	if hasPred {
		return predHome, predAway, true
	}
	if MarketClosed(m, now) {
		return 0, 0, true
	}
	return 0, 0, false
}

func EffectivePredEntry(m models.Match, predHome, predAway int, hasPred bool, now time.Time) PredEntry {
	h, a, counts := EffectivePrediction(m, predHome, predAway, hasPred, now)
	if !counts {
		return PredEntry{PredHome: noPredSentinel, PredAway: noPredSentinel}
	}
	return PredEntry{PredHome: h, PredAway: a}
}

func FillMissingPredictions(matches []models.Match, userID uuid.UUID, existing []models.Prediction, now time.Time) []models.Prediction {
	byMatch := make(map[uuid.UUID]models.Prediction, len(existing))
	for _, p := range existing {
		byMatch[p.MatchID] = p
	}

	out := make([]models.Prediction, 0, len(matches))
	for _, m := range matches {
		if p, ok := byMatch[m.ID]; ok {
			out = append(out, p)
			continue
		}
		if !MarketClosed(m, now) {
			continue
		}
		out = append(out, models.Prediction{
			UserID:     userID,
			MatchID:    m.ID,
			HomeGoals:  0,
			AwayGoals:  0,
			AutoFilled: true,
		})
	}
	return out
}
