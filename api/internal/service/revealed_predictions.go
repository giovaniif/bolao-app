package service

import (
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

func RevealedPredictions(matches []models.Match, userID uuid.UUID, existing []models.Prediction, now time.Time) ([]models.Prediction, bool) {
	closed := make([]models.Match, 0, len(matches))
	for _, m := range matches {
		if MarketClosed(m, now) {
			closed = append(closed, m)
		}
	}
	if len(closed) == 0 {
		return []models.Prediction{}, false
	}
	return FillMissingPredictions(closed, userID, existing, now), true
}
