package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/bolao-app/api/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type PredictionHandler struct {
	predictionRepo *repository.PredictionRepository
	matchRepo      *repository.MatchRepository
}

func NewPredictionHandler(predictionRepo *repository.PredictionRepository, matchRepo *repository.MatchRepository) *PredictionHandler {
	return &PredictionHandler{predictionRepo: predictionRepo, matchRepo: matchRepo}
}

type UpsertPredictionRequest struct {
	MatchID   string `json:"match_id" binding:"required"`
	HomeGoals int    `json:"home_goals" binding:"gte=0"`
	AwayGoals int    `json:"away_goals" binding:"gte=0"`
}

type UpsertPredictionsRequest struct {
	Predictions []struct {
		MatchID   string `json:"match_id" binding:"required"`
		HomeGoals int    `json:"home_goals" binding:"gte=0"`
		AwayGoals int    `json:"away_goals" binding:"gte=0"`
	} `json:"predictions" binding:"required"`
}

func (h *PredictionHandler) GetMyPredictions(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	round := c.Query("round")
	if round == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "parâmetro round é obrigatório"})
		return
	}

	roundInt, err := strconv.Atoi(round)
	if err != nil || roundInt < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "rodada inválida"})
		return
	}

	predictions, err := h.predictionRepo.GetByUserAndRound(c.Request.Context(), userID, roundInt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if predictions == nil {
		predictions = []models.Prediction{}
	}
	c.JSON(http.StatusOK, predictions)
}

// GetByUserAndRound returns another user's predictions for a round.
// Allowed only after the round's market has closed (all matches).
func (h *PredictionHandler) GetByUserAndRound(c *gin.Context) {
	roundStr := c.Param("round")
	round, err := strconv.Atoi(roundStr)
	if err != nil || round < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "rodada inválida"})
		return
	}
	userIDStr := c.Param("user_id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id inválido"})
		return
	}

	matches, err := h.matchRepo.ListByRound(c.Request.Context(), round)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	now := time.Now()
	for _, m := range matches {
		if m.MarketClosesAt == nil || now.Before(*m.MarketClosesAt) {
			c.JSON(http.StatusForbidden, gin.H{"error": "só é possível ver palpites de outros jogadores após o fechamento do mercado da rodada"})
			return
		}
	}

	predictions, err := h.predictionRepo.GetByUserAndRound(c.Request.Context(), userID, round)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if predictions == nil {
		predictions = []models.Prediction{}
	}
	c.JSON(http.StatusOK, predictions)
}

func (h *PredictionHandler) UpsertPredictions(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req UpsertPredictionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	for _, p := range req.Predictions {
		matchID, err := uuid.Parse(p.MatchID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "match_id inválido: " + p.MatchID})
			return
		}

		match, err := h.matchRepo.GetByID(c.Request.Context(), matchID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "jogo não encontrado"})
			return
		}

		if match.MarketClosesAt != nil && time.Now().After(*match.MarketClosesAt) {
			c.JSON(http.StatusForbidden, gin.H{"error": "mercado fechado para o jogo " + match.HomeTeam + " x " + match.AwayTeam})
			return
		}

		prediction := &models.Prediction{
			ID:        uuid.New(),
			UserID:    userID,
			MatchID:   matchID,
			HomeGoals: p.HomeGoals,
			AwayGoals: p.AwayGoals,
		}
		if err := h.predictionRepo.Upsert(c.Request.Context(), prediction); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "palpites salvos"})
}
