package handler

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/bolao-app/api/internal/auth"
	"github.com/bolao-app/api/internal/service"
	"github.com/gin-gonic/gin"
)

type fakeResetter struct {
	requested []string
	resetHash string
	validTok  string
}

func (f *fakeResetter) Request(_ context.Context, login string) error {
	f.requested = append(f.requested, login)
	return nil
}

func (f *fakeResetter) Reset(_ context.Context, token, passwordHash string) error {
	if token != f.validTok {
		return service.ErrInvalidResetToken
	}
	f.resetHash = passwordHash
	return nil
}

func resetRouter(f *fakeResetter) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewPasswordResetHandler(f)
	r.POST("/api/auth/forgot-password", h.Forgot)
	r.POST("/api/auth/reset-password", h.Reset)
	return r
}

func TestForgotPassword_AlwaysAnswers204(t *testing.T) {
	for _, body := range []string{`{"login":"maria"}`, `{"login":"ninguem@example.com"}`, `{}`, `not json`} {
		f := &fakeResetter{}
		w := do(t, resetRouter(f), http.MethodPost, "/api/auth/forgot-password", body, nil)
		if w.Code != http.StatusNoContent {
			t.Errorf("body %s: status = %d, want 204", body, w.Code)
		}
	}
}

func TestForgotPassword_PassesTheLoginOn(t *testing.T) {
	f := &fakeResetter{}
	do(t, resetRouter(f), http.MethodPost, "/api/auth/forgot-password", `{"login":"maria"}`, nil)
	if len(f.requested) != 1 || f.requested[0] != "maria" {
		t.Errorf("requested = %v, want [maria]", f.requested)
	}
}

func TestResetPassword(t *testing.T) {
	tests := []struct {
		name string
		body string
		want int
		msg  string
	}{
		{"a valid token sets the password", `{"token":"good","new_password":"segredo123"}`, http.StatusNoContent, ""},
		{"a bad token is refused", `{"token":"bad","new_password":"segredo123"}`, http.StatusBadRequest, "link inválido ou expirado"},
		{"a short password is refused", `{"token":"good","new_password":"123"}`, http.StatusBadRequest, "8 caracteres"},
		{"a bad body is refused", `nope`, http.StatusBadRequest, "link inválido ou expirado"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := &fakeResetter{validTok: "good"}
			w := do(t, resetRouter(f), http.MethodPost, "/api/auth/reset-password", tt.body, nil)
			if w.Code != tt.want || !strings.Contains(w.Body.String(), tt.msg) {
				t.Errorf("status = %d body = %s, want %d with %q", w.Code, w.Body, tt.want, tt.msg)
			}
		})
	}
}

func TestResetPassword_StoresABcryptHash(t *testing.T) {
	f := &fakeResetter{validTok: "good"}
	do(t, resetRouter(f), http.MethodPost, "/api/auth/reset-password", `{"token":"good","new_password":"segredo123"}`, nil)
	if f.resetHash == "segredo123" || !auth.CheckPassword(f.resetHash, "segredo123") {
		t.Errorf("hash = %q, want a bcrypt hash of the new password", f.resetHash)
	}
}
