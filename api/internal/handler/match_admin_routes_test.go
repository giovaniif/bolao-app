package handler

import (
	"net/http"
	"strings"
	"testing"

	"github.com/bolao-app/api/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func adminScopedRouter(memberships fakeMemberships) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	api := r.Group("/api", AuthMiddleware(testJWTSecret))
	admin := api.Group("", AdminMiddleware())
	api.PUT("/boloes/:id/participants/:user_id", func(c *gin.Context) {})
	NewMatchHandler(nil, nil, nil).AdminRoutes(admin, RequireMember(memberships))
	return r
}

func TestMatchAdminRoutesRegisterScopedOverrides(t *testing.T) {
	r := adminScopedRouter(fakeMemberships{})
	want := map[string]bool{
		"PUT /api/boloes/:id/matches/:match_id/results":   false,
		"DELETE /api/boloes/:id/matches/:match_id/lock":   false,
		"PUT /api/boloes/:id/matches/round/:round/closes": false,
	}
	for _, route := range r.Routes() {
		key := route.Method + " " + route.Path
		if _, ok := want[key]; ok {
			want[key] = true
		}
	}
	for key, found := range want {
		if !found {
			t.Errorf("route %s is not registered", key)
		}
	}
}

func TestMatchAdminRoutesGuards(t *testing.T) {
	bolaoID := uuid.New()
	member, platform := uuid.New(), uuid.New()
	memberships := fakeMemberships{member: {Role: models.MemberRoleOwner, Status: models.MemberStatusActive}}
	base := "/api/boloes/" + bolaoID.String() + "/matches/"
	tests := []struct {
		name       string
		user       uuid.UUID
		isAdmin    bool
		method     string
		path       string
		body       string
		wantStatus int
		wantBody   string
	}{
		{"a bolão owner who is not platform admin cannot override results", member, false, http.MethodPut, base + uuid.NewString() + "/results", `{"home_goals":1,"away_goals":0}`, http.StatusForbidden, "acesso restrito a administradores"},
		{"a bolão owner who is not platform admin cannot unlock", member, false, http.MethodDelete, base + uuid.NewString() + "/lock", "", http.StatusForbidden, ""},
		{"a bolão owner who is not platform admin cannot edit the close time", member, false, http.MethodPut, base + "round/3/closes", `{"market_closes_at":"2026-10-21T20:00:00Z"}`, http.StatusForbidden, ""},
		{"the platform admin gets a bad request for a bad match id on results", platform, true, http.MethodPut, base + "nope/results", `{"home_goals":1,"away_goals":0}`, http.StatusBadRequest, "id inválido"},
		{"the platform admin gets a bad request for a bad match id on unlock", platform, true, http.MethodDelete, base + "nope/lock", "", http.StatusBadRequest, "id inválido"},
		{"the platform admin gets a bad request for a bad round", platform, true, http.MethodPut, base + "round/x/closes", `{"market_closes_at":"2026-10-21T20:00:00Z"}`, http.StatusBadRequest, "rodada inválida"},
		{"a bad bolão id is a bad request", platform, true, http.MethodDelete, "/api/boloes/nope/matches/" + uuid.NewString() + "/lock", "", http.StatusBadRequest, "id inválido"},
	}
	r := adminScopedRouter(memberships)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := do(t, r, tt.method, tt.path, tt.body, tokenFor(t, tt.user, tt.isAdmin))
			if w.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d (%s)", w.Code, tt.wantStatus, w.Body.String())
			}
			if !strings.Contains(w.Body.String(), tt.wantBody) {
				t.Errorf("body = %s, want %q", w.Body.String(), tt.wantBody)
			}
		})
	}
}

func TestMatchIDParamPrefersTheScopedMatchID(t *testing.T) {
	scoped := uuid.New()
	c := &gin.Context{Params: gin.Params{{Key: "id", Value: uuid.NewString()}, {Key: "match_id", Value: scoped.String()}}}
	got, err := matchIDParam(c)
	if err != nil || got != scoped {
		t.Fatalf("matchIDParam = %v, %v; want %v", got, err, scoped)
	}
	legacy := uuid.New()
	c = &gin.Context{Params: gin.Params{{Key: "id", Value: legacy.String()}}}
	got, err = matchIDParam(c)
	if err != nil || got != legacy {
		t.Fatalf("matchIDParam = %v, %v; want %v", got, err, legacy)
	}
}
