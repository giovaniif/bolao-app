package handler

import (
	"github.com/bolao-app/api/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// resolveBolaoID reads an optional ?bolao_id= query param (for browsing a specific
// bolão's history, read-only) and falls back to the currently active bolão when absent.
func resolveBolaoID(c *gin.Context, bolaoRepo *repository.BolaoRepository) (uuid.UUID, error) {
	if raw := c.Query("bolao_id"); raw != "" {
		return uuid.Parse(raw)
	}
	active, err := bolaoRepo.GetActive(c.Request.Context())
	if err != nil {
		return uuid.UUID{}, err
	}
	return active.ID, nil
}
