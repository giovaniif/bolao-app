package handler

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/bolao-app/api/internal/models"
	"github.com/bolao-app/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type fakeFinishStore map[uuid.UUID]*models.Bolao

func (f fakeFinishStore) GetActive(context.Context) (*models.Bolao, error) {
	return nil, errors.New("no rows")
}

func (f fakeFinishStore) GetByID(_ context.Context, id uuid.UUID) (*models.Bolao, error) {
	if b, ok := f[id]; ok {
		return b, nil
	}
	return nil, errors.New("no rows")
}

func (f fakeFinishStore) Finish(_ context.Context, id uuid.UUID) error {
	f[id].Status = "finished"
	return nil
}

func (f fakeFinishStore) Create(context.Context, string) (*models.Bolao, error) {
	return nil, errors.New("not used")
}

func (f fakeFinishStore) EnrollAllUsers(context.Context, uuid.UUID) error { return nil }

type fakeFinishMatchList map[uuid.UUID][]models.Match

func (f fakeFinishMatchList) ListAllByBolao(_ context.Context, id uuid.UUID) ([]models.Match, error) {
	return f[id], nil
}

func finishRouter(boloes fakeFinishStore, matches fakeFinishMatchList, memberships fakeMemberships) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	api := r.Group("/api", AuthMiddleware(testJWTSecret))
	admin := api.Group("", AdminMiddleware())
	NewBolaoHandler(service.NewBolaoService(boloes, matches), nil).AdminRoutes(admin, RequireMember(memberships))
	return r
}

func TestFinishBolaoRoute(t *testing.T) {
	member, platform := uuid.New(), uuid.New()
	memberships := fakeMemberships{member: {Role: models.MemberRoleOwner, Status: models.MemberStatusActive}}
	two := 2
	tests := []struct {
		name       string
		status     string
		matches    []models.Match
		user       uuid.UUID
		isAdmin    bool
		body       string
		wantStatus int
		wantBody   string
	}{
		{"the platform admin finishes the bolão of the route", "active", nil, platform, true, "", http.StatusOK, `"status":"finished"`},
		{"a match without result blocks the finish", "active", []models.Match{{Round: 4}}, platform, true, "", http.StatusConflict, `"rounds":[4]`},
		{"force finishes despite a match without result", "active", []models.Match{{Round: 4, HomeGoals: &two}}, platform, true, `{"force":true}`, http.StatusOK, `"status":"finished"`},
		{"a finished bolão cannot be finished again", "finished", nil, platform, true, "", http.StatusConflict, "este bolão já terminou"},
		{"a bolão owner who is not platform admin cannot finish", "active", nil, member, false, "", http.StatusForbidden, "acesso restrito a administradores"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			id := uuid.New()
			boloes := fakeFinishStore{id: {ID: id, Status: tt.status}}
			r := finishRouter(boloes, fakeFinishMatchList{id: tt.matches}, memberships)
			w := do(t, r, http.MethodPost, "/api/boloes/"+id.String()+"/finish", tt.body, tokenFor(t, tt.user, tt.isAdmin))
			if w.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d (%s)", w.Code, tt.wantStatus, w.Body.String())
			}
			if !strings.Contains(w.Body.String(), tt.wantBody) {
				t.Errorf("body = %s, want %q", w.Body.String(), tt.wantBody)
			}
		})
	}
}

func TestFinishUnknownBolaoIsNotFound(t *testing.T) {
	r := finishRouter(fakeFinishStore{}, fakeFinishMatchList{}, fakeMemberships{})
	w := do(t, r, http.MethodPost, "/api/boloes/"+uuid.NewString()+"/finish", "", tokenFor(t, uuid.New(), true))
	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404 (%s)", w.Code, w.Body.String())
	}
}
