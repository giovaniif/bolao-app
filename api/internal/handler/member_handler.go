package handler

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/bolao-app/api/internal/models"
	"github.com/bolao-app/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type memberStore interface {
	membershipGetter
	Add(ctx context.Context, bolaoID, userID uuid.UUID, role, status string) error
	SetStatus(ctx context.Context, bolaoID, userID uuid.UUID, status string) error
	SetRole(ctx context.Context, bolaoID, userID uuid.UUID, role string) error
	TransferOwnership(ctx context.Context, bolaoID, from, to uuid.UUID) error
	CountActive(ctx context.Context, bolaoID uuid.UUID) (int, error)
	ListByBolao(ctx context.Context, bolaoID uuid.UUID) ([]models.MemberView, error)
	ListBoloesOfUser(ctx context.Context, userID uuid.UUID) ([]models.MyBolao, error)
}

type ownedBolaoStore interface {
	GetByID(ctx context.Context, id uuid.UUID) (*models.Bolao, error)
	CreateOwned(ctx context.Context, name string, ownerID uuid.UUID) (*models.Bolao, error)
	UpdateSettings(ctx context.Context, id uuid.UUID, name, visibility string, requiresApproval bool) error
	CountOwnedActive(ctx context.Context, ownerID uuid.UUID) (int, error)
}

type MemberHandler struct {
	members memberStore
	boloes  ownedBolaoStore
}

func NewMemberHandler(members memberStore, boloes ownedBolaoStore) *MemberHandler {
	return &MemberHandler{members: members, boloes: boloes}
}

func (h *MemberHandler) Routes(api *gin.RouterGroup, requireMember gin.HandlerFunc) {
	api.GET("/me/boloes", h.ListMine)
	api.POST("/me/boloes", h.Create)
	scoped := api.Group("/boloes/:id", requireMember)
	scoped.PATCH("", RequireAction(service.ActionEditSettings), h.UpdateSettings)
	scoped.GET("/members", h.ListMembers)
	scoped.POST("/members/:user_id/approve", RequireAction(service.ActionReviewRequests), h.Approve)
	scoped.POST("/members/:user_id/reject", RequireAction(service.ActionReviewRequests), h.Reject)
	scoped.PUT("/members/:user_id/role", RequireAction(service.ActionChangeRole), h.ChangeRole)
	scoped.DELETE("/members/:user_id", RequireAction(service.ActionRemoveMember), h.Remove)
	scoped.POST("/leave", h.Leave)
}

type BolaoSettingsRequest struct {
	Name             string `json:"name"`
	Visibility       string `json:"visibility"`
	RequiresApproval bool   `json:"requires_approval"`
}

func validBolaoName(name string) (string, bool) {
	name = strings.TrimSpace(name)
	return name, len([]rune(name)) >= 3 && len([]rune(name)) <= 100
}

func (h *MemberHandler) ListMine(c *gin.Context) {
	boloes, err := h.members.ListBoloesOfUser(c.Request.Context(), c.MustGet("user_id").(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if boloes == nil {
		boloes = []models.MyBolao{}
	}
	c.JSON(http.StatusOK, boloes)
}

func (h *MemberHandler) Create(c *gin.Context) {
	var req struct {
		Name string `json:"name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	name, ok := validBolaoName(req.Name)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "o nome deve ter entre 3 e 100 caracteres"})
		return
	}
	userID := c.MustGet("user_id").(uuid.UUID)
	owned, err := h.boloes.CountOwnedActive(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if err := service.CanCreateBolao(owned); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}
	bolao, err := h.boloes.CreateOwned(c.Request.Context(), name, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, bolao)
}

func (h *MemberHandler) UpdateSettings(c *gin.Context) {
	var req BolaoSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	name, ok := validBolaoName(req.Name)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "o nome deve ter entre 3 e 100 caracteres"})
		return
	}
	if req.Visibility != "private" && req.Visibility != "public" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "visibilidade inválida"})
		return
	}
	bolaoID, _ := scopedBolaoID(c)
	if err := h.boloes.UpdateSettings(c.Request.Context(), bolaoID, name, req.Visibility, req.RequiresApproval); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	bolao, err := h.boloes.GetByID(c.Request.Context(), bolaoID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, bolao)
}

func (h *MemberHandler) ListMembers(c *gin.Context) {
	bolaoID, _ := scopedBolaoID(c)
	members, err := h.members.ListByBolao(c.Request.Context(), bolaoID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	seesRequests := service.CanManage(c.GetString(ctxMemberRole), service.ActionReviewRequests)
	visible := make([]models.MemberView, 0, len(members))
	for _, m := range members {
		if m.Status == models.MemberStatusActive || seesRequests {
			visible = append(visible, m)
		}
	}
	c.JSON(http.StatusOK, visible)
}

func (h *MemberHandler) target(c *gin.Context) (uuid.UUID, *models.Membership, bool) {
	bolaoID, _ := scopedBolaoID(c)
	userID, err := uuid.Parse(c.Param("user_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id inválido"})
		return bolaoID, nil, false
	}
	m, err := h.members.Get(c.Request.Context(), bolaoID, userID)
	if err != nil || m.Status == models.MemberStatusRemoved {
		c.JSON(http.StatusNotFound, gin.H{"error": "participante não encontrado"})
		return bolaoID, nil, false
	}
	m.UserID = userID
	return bolaoID, m, true
}

func (h *MemberHandler) Approve(c *gin.Context) {
	bolaoID, m, ok := h.target(c)
	if !ok {
		return
	}
	if m.Status != models.MemberStatusPending {
		c.JSON(http.StatusConflict, gin.H{"error": "não há pedido pendente para este participante"})
		return
	}
	bolao, err := h.boloes.GetByID(c.Request.Context(), bolaoID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	active, err := h.members.CountActive(c.Request.Context(), bolaoID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if err := service.CanApprove(service.JoinTarget{ActiveMembers: active, MaxMembers: bolao.MaxMembers}); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}
	h.setStatus(c, bolaoID, m.UserID, models.MemberStatusActive)
}

func (h *MemberHandler) Reject(c *gin.Context) {
	bolaoID, m, ok := h.target(c)
	if !ok {
		return
	}
	if m.Status != models.MemberStatusPending {
		c.JSON(http.StatusConflict, gin.H{"error": "não há pedido pendente para este participante"})
		return
	}
	h.setStatus(c, bolaoID, m.UserID, models.MemberStatusRemoved)
}

func (h *MemberHandler) ChangeRole(c *gin.Context) {
	var req struct {
		Role string `json:"role"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	bolaoID, m, ok := h.target(c)
	if !ok {
		return
	}
	if m.Status != models.MemberStatusActive {
		c.JSON(http.StatusConflict, gin.H{"error": "o participante ainda não foi aprovado"})
		return
	}
	targetRole, _, err := service.RoleChange(c.GetString(ctxMemberRole), m.Role, req.Role)
	if err != nil {
		c.JSON(statusFor(err), gin.H{"error": err.Error()})
		return
	}
	if targetRole == models.MemberRoleOwner {
		err = h.members.TransferOwnership(c.Request.Context(), bolaoID, c.MustGet("user_id").(uuid.UUID), m.UserID)
	} else {
		err = h.members.SetRole(c.Request.Context(), bolaoID, m.UserID, targetRole)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"role": targetRole})
}

func (h *MemberHandler) Remove(c *gin.Context) {
	bolaoID, m, ok := h.target(c)
	if !ok {
		return
	}
	self := m.UserID == c.MustGet("user_id").(uuid.UUID)
	if err := service.CanRemove(c.GetString(ctxMemberRole), m.Role, self); err != nil {
		c.JSON(statusFor(err), gin.H{"error": err.Error()})
		return
	}
	h.setStatus(c, bolaoID, m.UserID, models.MemberStatusRemoved)
}

func (h *MemberHandler) Leave(c *gin.Context) {
	bolaoID, _ := scopedBolaoID(c)
	if err := service.CanLeave(c.GetString(ctxMemberRole)); err != nil {
		c.JSON(statusFor(err), gin.H{"error": err.Error()})
		return
	}
	h.setStatus(c, bolaoID, c.MustGet("user_id").(uuid.UUID), models.MemberStatusRemoved)
}

func (h *MemberHandler) setStatus(c *gin.Context, bolaoID, userID uuid.UUID, status string) {
	if err := h.members.SetStatus(c.Request.Context(), bolaoID, userID, status); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": status})
}

func statusFor(err error) int {
	switch {
	case errors.Is(err, service.ErrForbidden):
		return http.StatusForbidden
	case errors.Is(err, service.ErrInvalidRole):
		return http.StatusBadRequest
	default:
		return http.StatusConflict
	}
}
