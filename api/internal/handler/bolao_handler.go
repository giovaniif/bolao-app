package handler

import (
	"errors"
	"net/http"

	"github.com/bolao-app/api/internal/models"
	"github.com/bolao-app/api/internal/repository"
	"github.com/bolao-app/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type BolaoHandler struct {
	bolaoSvc  *service.BolaoService
	bolaoRepo *repository.BolaoRepository
}

func NewBolaoHandler(bolaoSvc *service.BolaoService, bolaoRepo *repository.BolaoRepository) *BolaoHandler {
	return &BolaoHandler{bolaoSvc: bolaoSvc, bolaoRepo: bolaoRepo}
}

type CreateBolaoRequest struct {
	Name string `json:"name" binding:"required"`
}

type FinishBolaoRequest struct {
	Force bool `json:"force"`
}

func (h *BolaoHandler) List(c *gin.Context) {
	boloes, err := h.bolaoRepo.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if boloes == nil {
		boloes = []models.Bolao{}
	}
	c.JSON(http.StatusOK, boloes)
}

func (h *BolaoHandler) GetActive(c *gin.Context) {
	active, err := h.bolaoRepo.GetActive(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "nenhum bolão ativo encontrado"})
		return
	}
	c.JSON(http.StatusOK, active)
}

func (h *BolaoHandler) ListParticipants(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}
	participants, err := h.bolaoRepo.ListParticipants(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if participants == nil {
		participants = []models.ParticipantView{}
	}
	c.JSON(http.StatusOK, participants)
}

func (h *BolaoHandler) Create(c *gin.Context) {
	var req CreateBolaoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	bolao, err := h.bolaoSvc.CreateNew(c.Request.Context(), req.Name)
	if err != nil {
		if errors.Is(err, service.ErrActiveBolaoExists) {
			c.JSON(http.StatusConflict, gin.H{"error": "finalize o bolão atual antes de criar um novo"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, bolao)
}

func (h *BolaoHandler) FinishActive(c *gin.Context) {
	var req FinishBolaoRequest
	// Body is optional; ignore bind errors and default to force=false.
	_ = c.ShouldBindJSON(&req)

	bolao, err := h.bolaoSvc.FinishActive(c.Request.Context(), req.Force)
	if err != nil {
		var unresolved *service.ErrUnresolvedMatches
		if errors.As(err, &unresolved) {
			c.JSON(http.StatusConflict, gin.H{
				"error":  "existem jogos sem resultado definido",
				"rounds": unresolved.Rounds,
				"count":  unresolved.Count,
			})
			return
		}
		if errors.Is(err, service.ErrNoActiveBolao) {
			c.JSON(http.StatusNotFound, gin.H{"error": "nenhum bolão ativo encontrado"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, bolao)
}

func (h *BolaoHandler) UpdateParticipantAmountPaid(c *gin.Context) {
	bolaoID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}
	userID, err := uuid.Parse(c.Param("user_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id inválido"})
		return
	}

	var req struct {
		AmountPaid float64 `json:"amount_paid" binding:"gte=0"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.bolaoRepo.UpdateParticipantAmountPaid(c.Request.Context(), bolaoID, userID, req.AmountPaid); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "pagamento atualizado"})
}
