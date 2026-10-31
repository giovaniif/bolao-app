package handler

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/bolao-app/api/internal/auth"
	"github.com/bolao-app/api/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func refreshRouter(accounts *fakeAccounts) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewAuthHandler(accounts, testJWTSecret)
	api := r.Group("/api")
	api.Use(AuthMiddleware(testJWTSecret))
	api.POST("/auth/refresh", h.Refresh)
	return r
}

func refreshBearer(t *testing.T, u *models.User) map[string]string {
	t.Helper()
	token, err := auth.GenerateToken(u.ID, u.Username, u.IsAdmin, testJWTSecret)
	if err != nil {
		t.Fatal(err)
	}
	return map[string]string{"Authorization": "Bearer " + token}
}

func TestRefresh_IssuesANewTokenForTheCurrentUser(t *testing.T) {
	ana := &models.User{ID: uuid.New(), Username: "ana", IsAdmin: true}
	w := do(t, refreshRouter(&fakeAccounts{users: map[string]*models.User{"ana": ana}}), http.MethodPost, "/api/auth/refresh", "", refreshBearer(t, ana))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", w.Code, w.Body)
	}
	var got LoginResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	claims, err := auth.ParseToken(got.Token, testJWTSecret)
	if err != nil || claims.UserID != ana.ID || got.Username != "ana" || !got.IsAdmin {
		t.Errorf("got %+v claims %+v err %v", got, claims, err)
	}
}

func TestRefresh_RefusesAMissingOrDeletedUser(t *testing.T) {
	gone := &models.User{ID: uuid.New(), Username: "gone"}
	deleted := &models.User{ID: uuid.New(), Username: "excluido_abc123def456"}
	accounts := &fakeAccounts{users: map[string]*models.User{deleted.Username: deleted}}
	for _, u := range []*models.User{gone, deleted} {
		w := do(t, refreshRouter(accounts), http.MethodPost, "/api/auth/refresh", "", refreshBearer(t, u))
		if w.Code != http.StatusUnauthorized {
			t.Errorf("%s: status = %d, want 401", u.Username, w.Code)
		}
	}
}

func TestRefresh_RefusesARequestWithoutAToken(t *testing.T) {
	w := do(t, refreshRouter(&fakeAccounts{users: map[string]*models.User{}}), http.MethodPost, "/api/auth/refresh", "", nil)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", w.Code)
	}
}
