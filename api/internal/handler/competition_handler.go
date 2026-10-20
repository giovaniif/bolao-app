package handler

import (
	"context"
	"net/http"

	"github.com/bolao-app/api/internal/models"
	"github.com/gin-gonic/gin"
)

type competitionLister interface {
	ListActive(ctx context.Context) ([]models.Competition, error)
}

type CompetitionHandler struct {
	competitions competitionLister
}

func NewCompetitionHandler(competitions competitionLister) *CompetitionHandler {
	return &CompetitionHandler{competitions: competitions}
}

func (h *CompetitionHandler) List(c *gin.Context) {
	competitions, err := h.competitions.ListActive(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, competitions)
}
