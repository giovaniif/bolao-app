package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/bolao-app/api/internal/constants"
	"github.com/bolao-app/api/internal/models"
	"github.com/bolao-app/api/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type MatchHandler struct {
	matchRepo *repository.MatchRepository
}

func NewMatchHandler(matchRepo *repository.MatchRepository) *MatchHandler {
	return &MatchHandler{matchRepo: matchRepo}
}

type CreateMatchRequest struct {
	Round          int           `json:"round" binding:"required"`
	HomeTeam       string        `json:"home_team" binding:"required"`
	AwayTeam       string        `json:"away_team" binding:"required"`
	MarketClosesAt *FlexibleTime `json:"market_closes_at"`
}

type CreateMatchesRequest struct {
	Round          int           `json:"round" binding:"required"`
	MarketClosesAt *FlexibleTime `json:"market_closes_at"`
	Matches        []struct {
		HomeTeam string `json:"home_team" binding:"required"`
		AwayTeam string `json:"away_team" binding:"required"`
	} `json:"matches" binding:"required"`
}

type UpdateResultsRequest struct {
	HomeGoals int `json:"home_goals" binding:"gte=0"`
	AwayGoals int `json:"away_goals" binding:"gte=0"`
}

type UpdateRoundClosesRequest struct {
	MarketClosesAt *FlexibleTime `json:"market_closes_at" binding:"required"`
}

type UpdateMatchRequest struct {
	HomeTeam string `json:"home_team" binding:"required"`
	AwayTeam string `json:"away_team" binding:"required"`
}

func (h *MatchHandler) ListRounds(c *gin.Context) {
	rounds, err := h.matchRepo.ListRounds(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if rounds == nil {
		rounds = []int{}
	}
	c.JSON(http.StatusOK, rounds)
}

func (h *MatchHandler) ListByRound(c *gin.Context) {
	round, err := strconv.Atoi(c.Param("round"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "rodada inválida"})
		return
	}

	matches, err := h.matchRepo.ListByRound(c.Request.Context(), round)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if matches == nil {
		matches = []models.Match{}
	}
	c.JSON(http.StatusOK, matches)
}

func (h *MatchHandler) CreateMatches(c *gin.Context) {
	var req CreateMatchesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	for _, m := range req.Matches {
		if !contains(constants.Teams, m.HomeTeam) || !contains(constants.Teams, m.AwayTeam) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "time inválido: " + m.HomeTeam + " x " + m.AwayTeam})
			return
		}
	}

	var created []models.Match
	var closesAt *time.Time
	if req.MarketClosesAt != nil && req.MarketClosesAt.Time != nil {
		closesAt = req.MarketClosesAt.Time
	}
	for _, m := range req.Matches {
		match := &models.Match{
			ID:             uuid.New(),
			Round:          req.Round,
			HomeTeam:       m.HomeTeam,
			AwayTeam:       m.AwayTeam,
			MarketClosesAt: closesAt,
		}
		if err := h.matchRepo.Create(c.Request.Context(), match); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		created = append(created, *match)
	}

	c.JSON(http.StatusCreated, created)
}

func (h *MatchHandler) UpdateResults(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}

	var req UpdateResultsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.matchRepo.UpdateResults(c.Request.Context(), id, req.HomeGoals, req.AwayGoals); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	match, _ := h.matchRepo.GetByID(c.Request.Context(), id)
	c.JSON(http.StatusOK, match)
}

func (h *MatchHandler) UpdateRoundCloses(c *gin.Context) {
	round, err := strconv.Atoi(c.Param("round"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "rodada inválida"})
		return
	}

	var req UpdateRoundClosesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var closesAt *time.Time
	if req.MarketClosesAt != nil && req.MarketClosesAt.Time != nil {
		closesAt = req.MarketClosesAt.Time
	}
	if err := h.matchRepo.UpdateMarketClosesAt(c.Request.Context(), round, closesAt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	matches, _ := h.matchRepo.ListByRound(c.Request.Context(), round)
	c.JSON(http.StatusOK, matches)
}

func (h *MatchHandler) UpdateMatch(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}

	var req UpdateMatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if !contains(constants.Teams, req.HomeTeam) || !contains(constants.Teams, req.AwayTeam) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "time inválido"})
		return
	}

	if err := h.matchRepo.Update(c.Request.Context(), id, req.HomeTeam, req.AwayTeam); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	match, _ := h.matchRepo.GetByID(c.Request.Context(), id)
	c.JSON(http.StatusOK, match)
}

func (h *MatchHandler) DeleteMatch(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}

	if err := h.matchRepo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "jogo excluído"})
}

func (h *MatchHandler) DeleteRound(c *gin.Context) {
	round, err := strconv.Atoi(c.Param("round"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "rodada inválida"})
		return
	}

	if err := h.matchRepo.DeleteRound(c.Request.Context(), round); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "rodada excluída"})
}
