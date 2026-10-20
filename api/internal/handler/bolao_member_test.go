package handler

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/bolao-app/api/internal/auth"
	"github.com/bolao-app/api/internal/models"
	"github.com/bolao-app/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type fakeMemberships map[uuid.UUID]*models.Membership

func (f fakeMemberships) Get(_ context.Context, _ uuid.UUID, userID uuid.UUID) (*models.Membership, error) {
	if m, ok := f[userID]; ok {
		return m, nil
	}
	return nil, errors.New("no rows")
}

func memberRouter(memberships fakeMemberships, action string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	api := r.Group("/api", AuthMiddleware(testJWTSecret))
	scoped := api.Group("/boloes/:id", RequireMember(memberships))
	handler := func(c *gin.Context) {
		bolaoID, err := resolveBolaoID(c, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"bolao_id": bolaoID, "role": c.GetString("member_role")})
	}
	scoped.GET("/read", handler)
	scoped.POST("/manage", RequireAction(action), handler)
	return r
}

func tokenFor(t *testing.T, userID uuid.UUID, isAdmin bool) map[string]string {
	t.Helper()
	token, err := auth.GenerateToken(userID, "u", isAdmin, testJWTSecret)
	if err != nil {
		t.Fatal(err)
	}
	return map[string]string{"Authorization": "Bearer " + token}
}

func TestRequireMember(t *testing.T) {
	bolaoID := uuid.New()
	active, pending, removed, stranger, platform := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()
	memberships := fakeMemberships{
		active:  {Role: models.MemberRoleParticipant, Status: models.MemberStatusActive},
		pending: {Role: models.MemberRoleParticipant, Status: models.MemberStatusPending},
		removed: {Role: models.MemberRoleAdmin, Status: models.MemberStatusRemoved},
	}
	tests := []struct {
		name       string
		user       uuid.UUID
		isAdmin    bool
		path       string
		wantStatus int
		wantBody   string
	}{
		{"an active member reads the bolão", active, false, "/api/boloes/" + bolaoID.String() + "/read", http.StatusOK, `"role":"participant"`},
		{"the scoped bolão replaces the active one", active, false, "/api/boloes/" + bolaoID.String() + "/read", http.StatusOK, bolaoID.String()},
		{"a pending member cannot read it", pending, false, "/api/boloes/" + bolaoID.String() + "/read", http.StatusNotFound, "bolão não encontrado"},
		{"a removed member cannot read it", removed, false, "/api/boloes/" + bolaoID.String() + "/read", http.StatusNotFound, ""},
		{"a stranger cannot read it", stranger, false, "/api/boloes/" + bolaoID.String() + "/read", http.StatusNotFound, ""},
		{"the platform admin reads any bolão as admin", platform, true, "/api/boloes/" + bolaoID.String() + "/read", http.StatusOK, `"role":"admin"`},
		{"a bad id is a bad request", active, false, "/api/boloes/nope/read", http.StatusBadRequest, ""},
	}
	r := memberRouter(memberships, service.ActionEditSettings)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := do(t, r, http.MethodGet, tt.path, "", tokenFor(t, tt.user, tt.isAdmin))
			if w.Code != tt.wantStatus {
				t.Errorf("status = %d body = %s, want %d", w.Code, w.Body, tt.wantStatus)
			}
			if tt.wantBody != "" && !strings.Contains(w.Body.String(), tt.wantBody) {
				t.Errorf("body = %s, want it to contain %s", w.Body, tt.wantBody)
			}
		})
	}
}

func TestRequireAction(t *testing.T) {
	bolaoID := uuid.New()
	owner, admin, participant := uuid.New(), uuid.New(), uuid.New()
	memberships := fakeMemberships{
		owner:       {Role: models.MemberRoleOwner, Status: models.MemberStatusActive},
		admin:       {Role: models.MemberRoleAdmin, Status: models.MemberStatusActive},
		participant: {Role: models.MemberRoleParticipant, Status: models.MemberStatusActive},
	}
	tests := []struct {
		name   string
		action string
		user   uuid.UUID
		want   int
	}{
		{"the owner edits the settings", service.ActionEditSettings, owner, http.StatusOK},
		{"an admin cannot edit the settings", service.ActionEditSettings, admin, http.StatusForbidden},
		{"an admin reviews requests", service.ActionReviewRequests, admin, http.StatusOK},
		{"a participant cannot review requests", service.ActionReviewRequests, participant, http.StatusForbidden},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := do(t, memberRouter(memberships, tt.action), http.MethodPost, "/api/boloes/"+bolaoID.String()+"/manage", "", tokenFor(t, tt.user, false))
			if w.Code != tt.want {
				t.Errorf("status = %d, want %d (%s)", w.Code, tt.want, w.Body)
			}
		})
	}
}
