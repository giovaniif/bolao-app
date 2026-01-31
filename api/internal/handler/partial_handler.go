package handler

import (
	"net/http"
	"strconv"

	"github.com/bolao-app/api/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type PartialHandler struct {
	matchRepo   *repository.MatchRepository
	partialRepo *repository.PartialRepository
}

func NewPartialHandler(matchRepo *repository.MatchRepository, partialRepo *repository.PartialRepository) *PartialHandler {
	return &PartialHandler{matchRepo: matchRepo, partialRepo: partialRepo}
}

type SetPartialRequest struct {
	HomeGoals int `json:"home_goals"`
	AwayGoals int `json:"away_goals"`
}

func (h *PartialHandler) ListByRound(c *gin.Context) {
	roundStr := c.Param("round")
	round, err := strconv.Atoi(roundStr)
	if err != nil || round < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "rodada inválida"})
		return
	}

	matches, err := h.matchRepo.ListByRound(c.Request.Context(), round)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	partials, err := h.partialRepo.ListByRound(c.Request.Context(), round)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	type MatchWithPartial struct {
		ID            string `json:"id"`
		HomeTeam      string `json:"home_team"`
		AwayTeam      string `json:"away_team"`
		HomeGoals     *int   `json:"home_goals,omitempty"`
		AwayGoals     *int   `json:"away_goals,omitempty"`
		PartialHome   *int   `json:"partial_home,omitempty"`
		PartialAway   *int   `json:"partial_away,omitempty"`
		RealHomeGoals *int   `json:"real_home_goals,omitempty"`
		RealAwayGoals *int   `json:"real_away_goals,omitempty"`
	}

	result := make([]MatchWithPartial, 0, len(matches))
	for _, m := range matches {
		item := MatchWithPartial{
			ID:            m.ID.String(),
			HomeTeam:      m.HomeTeam,
			AwayTeam:      m.AwayTeam,
			RealHomeGoals: m.HomeGoals,
			RealAwayGoals: m.AwayGoals,
		}
		if p, ok := partials[m.ID]; ok {
			item.PartialHome = &p.HomeGoals
			item.PartialAway = &p.AwayGoals
		}
		result = append(result, item)
	}

	c.JSON(http.StatusOK, result)
}

func (h *PartialHandler) SetPartial(c *gin.Context) {
	matchID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}

	var req SetPartialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "home_goals e away_goals são obrigatórios"})
		return
	}
	if req.HomeGoals < 0 || req.AwayGoals < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "gols não podem ser negativos"})
		return
	}

	userIDVal, _ := c.Get("user_id")
	userID := userIDVal.(uuid.UUID)

	if err := h.partialRepo.Upsert(c.Request.Context(), matchID, req.HomeGoals, req.AwayGoals, &userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	partial, _ := h.partialRepo.GetByMatch(c.Request.Context(), matchID)
	c.JSON(http.StatusOK, partial)
}
