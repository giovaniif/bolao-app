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

type fakeAccounts struct {
	users   map[string]*models.User
	created []string
}

func (f *fakeAccounts) GetByID(_ context.Context, id uuid.UUID) (*models.User, error) {
	for _, u := range f.users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, errors.New("no rows")
}

func (f *fakeAccounts) GetByUsername(_ context.Context, username string) (*models.User, error) {
	if u, ok := f.users[username]; ok {
		return u, nil
	}
	return nil, errors.New("no rows")
}

func (f *fakeAccounts) UpdatePassword(context.Context, uuid.UUID, string) error { return nil }

func (f *fakeAccounts) CreateAccount(_ context.Context, username, displayName, email, hash string) (*models.User, error) {
	if _, ok := f.users[username]; ok {
		return nil, repository.ErrUsernameTaken
	}
	if strings.Contains(email, "taken") {
		return nil, repository.ErrEmailTaken
	}
	u := &models.User{ID: uuid.New(), Username: username, DisplayName: displayName, PasswordHash: hash}
	f.users[username] = u
	f.created = append(f.created, email)
	return u, nil
}

func authRouter(accounts *fakeAccounts) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewAuthHandler(accounts, testJWTSecret)
	r.POST("/api/auth/login", h.Login)
	r.POST("/api/auth/signup", h.Signup)
	return r
}

func TestSignup(t *testing.T) {
	tests := []struct {
		name string
		body string
		want int
		msg  string
	}{
		{"a valid account is created and logged in", `{"username":"Joao.Silva","display_name":"João","email":"joao@example.com","password":"segredo123"}`, http.StatusCreated, `"token"`},
		{"a short password is refused", `{"username":"joao","display_name":"João","email":"joao@example.com","password":"123"}`, http.StatusBadRequest, "8 caracteres"},
		{"a username with spaces is refused", `{"username":"joão silva","display_name":"João","email":"joao@example.com","password":"segredo123"}`, http.StatusBadRequest, "usuário"},
		{"a bad email is refused", `{"username":"joao","display_name":"João","email":"joao","password":"segredo123"}`, http.StatusBadRequest, "e-mail"},
		{"a taken username is a conflict", `{"username":"maria","display_name":"Maria","email":"m@example.com","password":"segredo123"}`, http.StatusConflict, "usuário"},
		{"a taken email is a conflict", `{"username":"novo","display_name":"Novo","email":"taken@example.com","password":"segredo123"}`, http.StatusConflict, "e-mail"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			accounts := &fakeAccounts{users: map[string]*models.User{"maria": {ID: uuid.New(), Username: "maria"}}}
			w := do(t, authRouter(accounts), http.MethodPost, "/api/auth/signup", tt.body, nil)
			if w.Code != tt.want || !strings.Contains(w.Body.String(), tt.msg) {
				t.Errorf("status = %d body = %s, want %d with %q", w.Code, w.Body, tt.want, tt.msg)
			}
		})
	}
}

func TestSignup_StoresALowerCaseUsernameAndAHash(t *testing.T) {
	accounts := &fakeAccounts{users: map[string]*models.User{}}
	do(t, authRouter(accounts), http.MethodPost, "/api/auth/signup", `{"username":"Joao.Silva","display_name":"João","email":"joao@example.com","password":"segredo123"}`, nil)
	u, ok := accounts.users["joao.silva"]
	if !ok {
		t.Fatalf("users = %v, want joao.silva", accounts.users)
	}
	if u.PasswordHash == "segredo123" || !auth.CheckPassword(u.PasswordHash, "segredo123") {
		t.Error("the password was not stored as a hash")
	}
}

func TestLogin_AUserWithoutPasswordCannotLogInWithOne(t *testing.T) {
	accounts := &fakeAccounts{users: map[string]*models.User{"social": {ID: uuid.New(), Username: "social"}}}
	w := do(t, authRouter(accounts), http.MethodPost, "/api/auth/login", `{"username":"social","password":"anything"}`, nil)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", w.Code)
	}
}
