package handler

import (
	"github.com/bolao-app/api/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

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
