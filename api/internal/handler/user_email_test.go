package handler

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/bolao-app/api/internal/auth"
	"github.com/bolao-app/api/internal/models"
	"github.com/bolao-app/api/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type fakeUserStore struct {
	user    *models.User
	updated *models.User
}

func (f *fakeUserStore) List(context.Context) ([]models.User, error) { return nil, nil }
func (f *fakeUserStore) ListSharingBolaoWith(context.Context, uuid.UUID) ([]models.User, error) {
	return nil, nil
}
func (f *fakeUserStore) Create(context.Context, *models.User) error { return nil }
func (f *fakeUserStore) GetByID(context.Context, uuid.UUID) (*models.User, error) {
	u := *f.user
	return &u, nil
}
func (f *fakeUserStore) GetByUsernameExcluding(context.Context, string, uuid.UUID) (*models.User, error) {
	return nil, errors.New("no rows")
}
func (f *fakeUserStore) Update(_ context.Context, u *models.User) error {
	if u.Email != nil && strings.Contains(*u.Email, "taken") {
		return repository.ErrEmailTaken
	}
	f.updated = u
	return nil
}
func (f *fakeUserStore) DeleteAccount(context.Context, uuid.UUID, map[uuid.UUID]uuid.UUID) error {
	return nil
}
func (f *fakeUserStore) DeletionBlockers(context.Context, uuid.UUID) ([]models.DeletionBlocker, error) {
	return nil, nil
}

func meRouter(t *testing.T, store *fakeUserStore) (*gin.Engine, map[string]string) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewUserHandler(store, nil)
	r.PUT("/api/me", AuthMiddleware(testJWTSecret), h.UpdateMe)
	r.GET("/api/me", AuthMiddleware(testJWTSecret), h.GetMe)
	token, err := auth.GenerateToken(store.user.ID, store.user.Username, false, testJWTSecret)
	if err != nil {
		t.Fatal(err)
	}
	return r, map[string]string{"Authorization": "Bearer " + token}
}

func TestUpdateMe_Email(t *testing.T) {
	old := "old@example.com"
	tests := []struct {
		name      string
		current   *string
		body      string
		want      int
		wantEmail string
	}{
		{"a user without email adds one", nil, `{"username":"maria","display_name":"Maria","email":" Maria@Example.com "}`, http.StatusOK, "maria@example.com"},
		{"a user changes the email", &old, `{"username":"maria","display_name":"Maria","email":"new@example.com"}`, http.StatusOK, "new@example.com"},
		{"no email field keeps the email", &old, `{"username":"maria","display_name":"Maria"}`, http.StatusOK, old},
		{"a bad email is refused", nil, `{"username":"maria","display_name":"Maria","email":"maria"}`, http.StatusBadRequest, ""},
		{"a taken email is a conflict", nil, `{"username":"maria","display_name":"Maria","email":"taken@example.com"}`, http.StatusConflict, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := &fakeUserStore{user: &models.User{ID: uuid.New(), Username: "maria", DisplayName: "Maria", Email: tt.current}}
			r, headers := meRouter(t, store)
			w := do(t, r, http.MethodPut, "/api/me", tt.body, headers)
			if w.Code != tt.want {
				t.Fatalf("status = %d body = %s, want %d", w.Code, w.Body, tt.want)
			}
			if tt.wantEmail == "" {
				return
			}
			if store.updated == nil || store.updated.Email == nil || *store.updated.Email != tt.wantEmail {
				t.Errorf("updated = %+v, want email %s", store.updated, tt.wantEmail)
			}
			if !strings.Contains(w.Body.String(), `"email":"`+tt.wantEmail+`"`) {
				t.Errorf("body = %s, want the email in the JSON", w.Body)
			}
		})
	}
}

func TestGetMe_ReturnsTheEmail(t *testing.T) {
	email := "maria@example.com"
	store := &fakeUserStore{user: &models.User{ID: uuid.New(), Username: "maria", Email: &email}}
	r, headers := meRouter(t, store)
	w := do(t, r, http.MethodGet, "/api/me", "", headers)
	if !strings.Contains(w.Body.String(), `"email":"maria@example.com"`) {
		t.Errorf("body = %s, want the email", w.Body)
	}
}
