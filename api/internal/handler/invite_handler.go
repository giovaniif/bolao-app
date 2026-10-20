package handler

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/bolao-app/api/internal/repository"
	"github.com/bolao-app/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	inviteLinkTTL       = 7 * 24 * time.Hour
	maxInviteCodeLength = 12
)

type inviteStore interface {
	FindByCode(ctx context.Context, code string) (*models.Bolao, error)
	FindLink(ctx context.Context, token string) (uuid.UUID, error)
	UseLink(ctx context.Context, token string, now time.Time) (uuid.UUID, error)
	CreateLink(ctx context.Context, bolaoID, createdBy uuid.UUID, expiresAt time.Time, maxUses *int) (string, error)
	RotateCode(ctx context.Context, bolaoID uuid.UUID) (string, error)
}

type InviteHandler struct {
	invites inviteStore
	members memberStore
	boloes  ownedBolaoStore
	now     func() time.Time
}

func NewInviteHandler(invites inviteStore, members memberStore, boloes ownedBolaoStore) *InviteHandler {
	return &InviteHandler{invites: invites, members: members, boloes: boloes, now: time.Now}
}

func (h *InviteHandler) PublicRoutes(api *gin.RouterGroup) {
	api.GET("/invites/:code", h.Preview)
}

func (h *InviteHandler) Routes(api *gin.RouterGroup, requireMember gin.HandlerFunc) {
	api.POST("/invites/:code/join", h.Join)
	scoped := api.Group("/boloes/:id", requireMember)
	scoped.GET("/invite", RequireAction(service.ActionInvite), h.GetCode)
	scoped.POST("/invite/links", RequireAction(service.ActionInvite), h.CreateLink)
	scoped.POST("/invite/rotate", RequireAction(service.ActionEditSettings), h.Rotate)
}

type InvitePreview struct {
	Name        string `json:"name"`
	MemberCount int    `json:"member_count"`
	MaxMembers  int    `json:"max_members"`
	Joins       string `json:"joins"`
}

func isLinkToken(code string) bool {
	return len(code) > maxInviteCodeLength
}

func (h *InviteHandler) resolve(ctx context.Context, code string) (*models.Bolao, error) {
	if !isLinkToken(code) {
		return h.invites.FindByCode(ctx, code)
	}
	bolaoID, err := h.invites.FindLink(ctx, code)
	if err != nil {
		return nil, err
	}
	return h.boloes.GetByID(ctx, bolaoID)
}

func (h *InviteHandler) Preview(c *gin.Context) {
	code := c.Param("code")
	bolao, err := h.resolve(c.Request.Context(), code)
	if err != nil || bolao.Status != "active" {
		c.JSON(http.StatusNotFound, gin.H{"error": "convite não encontrado"})
		return
	}
	count, err := h.members.CountActive(c.Request.Context(), bolao.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	joins := "direct"
	if bolao.RequiresApproval && !isLinkToken(code) {
		joins = "request"
	}
	c.JSON(http.StatusOK, InvitePreview{Name: bolao.Name, MemberCount: count, MaxMembers: bolao.MaxMembers, Joins: joins})
}

func (h *InviteHandler) Join(c *gin.Context) {
	ctx := c.Request.Context()
	code := c.Param("code")
	userID := c.MustGet("user_id").(uuid.UUID)
	bolao, err := h.resolve(ctx, code)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "convite não encontrado"})
		return
	}
	via := service.JoinByCode
	if isLinkToken(code) {
		via = service.JoinByInviteLink
	}
	status, err := joinStatusFor(ctx, h.members, bolao, userID, via)
	if err != nil {
		c.JSON(statusForJoin(err), gin.H{"error": err.Error()})
		return
	}
	if via == service.JoinByInviteLink {
		if _, err := h.invites.UseLink(ctx, code, h.now()); err != nil {
			if errors.Is(err, repository.ErrInviteUnavailable) {
				c.JSON(http.StatusGone, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	if err := h.members.Add(ctx, bolao.ID, userID, models.MemberRoleParticipant, status); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"bolao_id": bolao.ID, "status": status})
}

func (h *InviteHandler) GetCode(c *gin.Context) {
	bolaoID, _ := scopedBolaoID(c)
	bolao, err := h.boloes.GetByID(c.Request.Context(), bolaoID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": bolao.InviteCode})
}

func (h *InviteHandler) CreateLink(c *gin.Context) {
	bolaoID, _ := scopedBolaoID(c)
	expires := h.now().Add(inviteLinkTTL)
	token, err := h.invites.CreateLink(c.Request.Context(), bolaoID, c.MustGet("user_id").(uuid.UUID), expires, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"token": token, "expires_at": expires})
}

func (h *InviteHandler) Rotate(c *gin.Context) {
	bolaoID, _ := scopedBolaoID(c)
	code, err := h.invites.RotateCode(c.Request.Context(), bolaoID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": code})
}

func joinStatusFor(ctx context.Context, members memberStore, bolao *models.Bolao, userID uuid.UUID, via string) (string, error) {
	count, err := members.CountActive(ctx, bolao.ID)
	if err != nil {
		return "", err
	}
	var current *models.Membership
	if m, err := members.Get(ctx, bolao.ID, userID); err == nil {
		current = m
	}
	return service.JoinStatus(service.JoinTarget{
		Active:           bolao.Status == "active",
		Public:           bolao.Visibility == "public",
		RequiresApproval: bolao.RequiresApproval,
		ActiveMembers:    count,
		MaxMembers:       bolao.MaxMembers,
	}, current, via)
}

func statusForJoin(err error) int {
	for _, known := range []error{service.ErrBolaoFinished, service.ErrAlreadyMember, service.ErrAlreadyRequested, service.ErrBolaoFull, service.ErrBolaoNotPublic} {
		if errors.Is(err, known) {
			return http.StatusConflict
		}
	}
	return http.StatusInternalServerError
}
