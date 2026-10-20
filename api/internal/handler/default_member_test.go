package handler

import (
	"context"
	"net/http"
	"testing"

	"github.com/bolao-app/api/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type fakeDefaultBolao struct{ id uuid.UUID }

func (f fakeDefaultBolao) GetActive(context.Context) (*models.Bolao, error) {
	return &models.Bolao{ID: f.id, Status: "active"}, nil
}

func TestRequireDefaultMembership(t *testing.T) {
	member, pending, outsider, platform := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	memberships := fakeMemberships{
		member:  {Role: models.MemberRoleParticipant, Status: models.MemberStatusActive},
		pending: {Role: models.MemberRoleParticipant, Status: models.MemberStatusPending},
	}
	gin.SetMode(gin.TestMode)
	r := gin.New()
	api := r.Group("/api", AuthMiddleware(testJWTSecret))
	api.POST("/predictions", RequireDefaultMembership(fakeDefaultBolao{uuid.New()}, memberships), func(c *gin.Context) { c.Status(http.StatusOK) })

	tests := []struct {
		name    string
		user    uuid.UUID
		isAdmin bool
		want    int
	}{
		{"a member of the default bolão saves", member, false, http.StatusOK},
		{"a pending member cannot save", pending, false, http.StatusForbidden},
		{"someone outside the default bolão cannot save", outsider, false, http.StatusForbidden},
		{"the platform admin saves", platform, true, http.StatusOK},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if w := do(t, r, http.MethodPost, "/api/predictions", "{}", tokenFor(t, tt.user, tt.isAdmin)); w.Code != tt.want {
				t.Errorf("status = %d, want %d", w.Code, tt.want)
			}
		})
	}
}
