package handler

import (
	"context"
	"net/http"
	"strings"

	"github.com/bolao-app/api/internal/models"
	"github.com/bolao-app/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const publicListLimit = 50

type publicBolaoStore interface {
	GetByID(ctx context.Context, id uuid.UUID) (*models.Bolao, error)
	ListPublic(ctx context.Context, search string, limit int) ([]models.PublicBolao, error)
	SetHidden(ctx context.Context, id uuid.UUID, hidden bool) error
}

type PublicBolaoHandler struct {
	members memberStore
	boloes  publicBolaoStore
}

func NewPublicBolaoHandler(members memberStore, boloes publicBolaoStore) *PublicBolaoHandler {
	return &PublicBolaoHandler{members: members, boloes: boloes}
}

func (h *PublicBolaoHandler) Routes(api *gin.RouterGroup, platformAdmin *gin.RouterGroup) {
	api.GET("/boloes/public", h.List)
	api.POST("/boloes/:id/join", h.Join)
	platformAdmin.PUT("/boloes/:id/hidden", h.SetHidden)
}

func (h *PublicBolaoHandler) List(c *gin.Context) {
	boloes, err := h.boloes.ListPublic(c.Request.Context(), strings.TrimSpace(c.Query("q")), publicListLimit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, boloes)
}

func (h *PublicBolaoHandler) Join(c *gin.Context) {
	ctx := c.Request.Context()
	bolaoID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}
	bolao, err := h.boloes.GetByID(ctx, bolaoID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "bolão não encontrado"})
		return
	}
	userID := c.MustGet("user_id").(uuid.UUID)
	status, err := joinStatusFor(ctx, h.members, bolao, userID, service.JoinFromListing)
	if err != nil {
		c.JSON(statusForJoin(err), gin.H{"error": err.Error()})
		return
	}
	if err := h.members.Add(ctx, bolao.ID, userID, models.MemberRoleParticipant, status); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"bolao_id": bolao.ID, "status": status})
}

func (h *PublicBolaoHandler) SetHidden(c *gin.Context) {
	bolaoID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}
	var req struct {
		Hidden bool `json:"hidden"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.boloes.SetHidden(c.Request.Context(), bolaoID, req.Hidden); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"hidden": req.Hidden})
}
