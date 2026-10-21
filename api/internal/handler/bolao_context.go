package handler

import (
	"context"
	"errors"
	"net/http"

	"github.com/bolao-app/api/internal/models"
	"github.com/bolao-app/api/internal/repository"
	"github.com/bolao-app/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	ctxBolaoID    = "bolao_id"
	ctxMemberRole = "member_role"
)

var (
	errBolaoFinished    = errors.New("bolão encerrado")
	errBolaoNotReadable = errors.New("bolão não encontrado")
	errBolaoRequired    = errors.New("bolão obrigatório")
)

func assertReadable(c *gin.Context, bolaoRepo *repository.BolaoRepository, bolaoID uuid.UUID) error {
	if isAdmin, _ := c.Get("is_admin"); isAdmin == true {
		return nil
	}
	readable, err := bolaoRepo.IsReadableBy(c.Request.Context(), bolaoID, c.MustGet("user_id").(uuid.UUID))
	if err != nil {
		return err
	}
	if !readable {
		return errBolaoNotReadable
	}
	return nil
}

type membershipGetter interface {
	Get(ctx context.Context, bolaoID, userID uuid.UUID) (*models.Membership, error)
}

func RequireMember(memberships membershipGetter) gin.HandlerFunc {
	return func(c *gin.Context) {
		bolaoID, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
			return
		}
		role := ""
		if isAdmin, _ := c.Get("is_admin"); isAdmin == true {
			role = models.MemberRoleAdmin
		}
		userID := c.MustGet("user_id").(uuid.UUID)
		if m, err := memberships.Get(c.Request.Context(), bolaoID, userID); err == nil && m.Status == models.MemberStatusActive {
			if role == "" || m.Role == models.MemberRoleOwner {
				role = m.Role
			}
		}
		if role == "" {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "bolão não encontrado"})
			return
		}
		c.Set(ctxBolaoID, bolaoID)
		c.Set(ctxMemberRole, role)
		c.Next()
	}
}

func RequireAction(action string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !service.CanManage(c.GetString(ctxMemberRole), action) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": service.ErrForbidden.Error()})
			return
		}
		c.Next()
	}
}

func scopedBolaoID(c *gin.Context) (uuid.UUID, bool) {
	v, ok := c.Get(ctxBolaoID)
	if !ok {
		return uuid.UUID{}, false
	}
	id, ok := v.(uuid.UUID)
	return id, ok
}

func resolveBolaoID(c *gin.Context, bolaoRepo *repository.BolaoRepository) (uuid.UUID, error) {
	if id, ok := scopedBolaoID(c); ok {
		return id, nil
	}
	raw := c.Query("bolao_id")
	if raw == "" {
		return uuid.UUID{}, errBolaoRequired
	}
	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.UUID{}, err
	}
	if err := assertReadable(c, bolaoRepo, id); err != nil {
		return uuid.UUID{}, err
	}
	return id, nil
}

func writableBolao(c *gin.Context, bolaoRepo *repository.BolaoRepository) (*models.Bolao, error) {
	id, ok := scopedBolaoID(c)
	if !ok {
		return bolaoRepo.GetActive(c.Request.Context())
	}
	bolao, err := bolaoRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		return nil, err
	}
	if bolao.Status != "active" {
		return nil, errBolaoFinished
	}
	return bolao, nil
}
