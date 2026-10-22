package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/bolao-app/api/internal/auth"
	"github.com/bolao-app/api/internal/models"
	"github.com/bolao-app/api/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type fakeVerifier struct {
	identities map[string]auth.Identity
}

func (f fakeVerifier) Verify(_ context.Context, token string) (auth.Identity, error) {
	if id, ok := f.identities[token]; ok {
		return id, nil
	}
	return auth.Identity{}, errors.New("bad token")
}

type identityKey struct{ provider, subject string }

type fakeSocialStore struct {
	users      map[uuid.UUID]*models.User
	emails     map[string]uuid.UUID
	identities map[identityKey]uuid.UUID
}

func newFakeSocialStore() *fakeSocialStore {
	return &fakeSocialStore{users: map[uuid.UUID]*models.User{}, emails: map[string]uuid.UUID{}, identities: map[identityKey]uuid.UUID{}}
}

func (f *fakeSocialStore) addUser(username, email string) *models.User {
	u := &models.User{ID: uuid.New(), Username: username, DisplayName: username}
	f.users[u.ID] = u
	if email != "" {
		f.emails[email] = u.ID
	}
	return u
}

func (f *fakeSocialStore) GetByID(_ context.Context, id uuid.UUID) (*models.User, error) {
	if u, ok := f.users[id]; ok {
		return u, nil
	}
	return nil, errors.New("no rows")
}

func (f *fakeSocialStore) UserIDByIdentity(_ context.Context, provider, subject string) (uuid.UUID, error) {
	if id, ok := f.identities[identityKey{provider, subject}]; ok {
		return id, nil
	}
	return uuid.Nil, repository.ErrIdentityNotFound
}

func (f *fakeSocialStore) UserIDByEmail(_ context.Context, email string) (uuid.UUID, error) {
	if id, ok := f.emails[email]; ok {
		return id, nil
	}
	return uuid.Nil, repository.ErrIdentityNotFound
}

func (f *fakeSocialStore) LinkIdentity(_ context.Context, userID uuid.UUID, provider, subject, _ string) error {
	f.identities[identityKey{provider, subject}] = userID
	return nil
}

func (f *fakeSocialStore) CreateSocialAccount(_ context.Context, username, email, provider, subject string) (*models.User, error) {
	for _, u := range f.users {
		if u.Username == username {
			return nil, repository.ErrUsernameTaken
		}
	}
	u := f.addUser(username, email)
	f.identities[identityKey{provider, subject}] = u.ID
	return u, nil
}

func (f *fakeSocialStore) UsernameExists(_ context.Context, username string) (bool, error) {
	for _, u := range f.users {
		if u.Username == username {
			return true, nil
		}
	}
	return false, nil
}

func socialRouter(store *fakeSocialStore, verifiers map[string]IDTokenVerifier) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewSocialAuthHandler(store, verifiers, testJWTSecret)
	r.POST("/api/auth/social", h.Login)
	r.GET("/api/auth/username-available", h.UsernameAvailable)
	return r
}

func postSocial(r *gin.Engine, body string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/social", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	return w
}

func googleVerifier() map[string]IDTokenVerifier {
	return map[string]IDTokenVerifier{"google": fakeVerifier{identities: map[string]auth.Identity{
		"known":       {Subject: "g-known", Email: "known@example.com", EmailVerified: true},
		"by-email":    {Subject: "g-new", Email: "existing@example.com", EmailVerified: true},
		"unverified":  {Subject: "g-unverified", Email: "existing@example.com", EmailVerified: false},
		"fresh":       {Subject: "g-fresh", Email: "fresh@example.com", EmailVerified: true},
		"taken-local": {Subject: "g-taken", Email: "existing@elsewhere.com", EmailVerified: true},
		"no-email":    {Subject: "g-no-email"},
	}}}
}

func TestSocialLoginStatus(t *testing.T) {
	tests := []struct {
		name string
		body string
		want int
		msg  string
	}{
		{"a known identity logs in", `{"provider":"google","id_token":"known"}`, http.StatusOK, `"token"`},
		{"a verified email of an existing user links and logs in", `{"provider":"google","id_token":"by-email"}`, http.StatusOK, `"username":"existing"`},
		{"a new identity without username asks for one", `{"provider":"google","id_token":"fresh"}`, http.StatusConflict, `"needs_username":true`},
		{"an unverified email never links to an existing user", `{"provider":"google","id_token":"unverified"}`, http.StatusConflict, `"needs_username":true`},
		{"a new identity with a username creates the account", `{"provider":"google","id_token":"fresh","username":"Novo.User"}`, http.StatusCreated, `"username":"novo.user"`},
		{"a taken username is refused", `{"provider":"google","id_token":"fresh","username":"existing"}`, http.StatusConflict, "nome de usuário"},
		{"an invalid username is refused", `{"provider":"google","id_token":"fresh","username":"a"}`, http.StatusBadRequest, "3 a 30"},
		{"an invalid token is refused", `{"provider":"google","id_token":"forged"}`, http.StatusUnauthorized, "inválido"},
		{"a provider without client ids is unavailable", `{"provider":"apple","id_token":"known"}`, http.StatusServiceUnavailable, "não está disponível"},
		{"an unknown provider is refused", `{"provider":"facebook","id_token":"known"}`, http.StatusBadRequest, "provedor"},
		{"a missing token is refused", `{"provider":"google"}`, http.StatusBadRequest, "dados"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newFakeSocialStore()
			known := store.addUser("known", "")
			store.identities[identityKey{"google", "g-known"}] = known.ID
			store.addUser("existing", "existing@example.com")
			w := postSocial(socialRouter(store, googleVerifier()), tt.body)
			if w.Code != tt.want || !strings.Contains(w.Body.String(), tt.msg) {
				t.Errorf("%s: got = %d %s, want %d containing %q", tt.name, w.Code, w.Body.String(), tt.want, tt.msg)
			}
		})
	}
}

func TestSocialLoginLinksTheIdentityByEmail(t *testing.T) {
	store := newFakeSocialStore()
	existing := store.addUser("existing", "existing@example.com")
	postSocial(socialRouter(store, googleVerifier()), `{"provider":"google","id_token":"by-email"}`)
	if got := store.identities[identityKey{"google", "g-new"}]; got != existing.ID {
		t.Errorf("linked user = %v, want %v", got, existing.ID)
	}
}

func TestSocialLoginTokenAuthenticatesTheUser(t *testing.T) {
	store := newFakeSocialStore()
	w := postSocial(socialRouter(store, googleVerifier()), `{"provider":"google","id_token":"fresh","username":"novo"}`)
	var resp LoginResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	claims, err := auth.ParseToken(resp.Token, testJWTSecret)
	if err != nil {
		t.Fatalf("parse token: %v", err)
	}
	if claims.Username != "novo" || claims.UserID.String() != resp.UserID {
		t.Errorf("claims = %+v, want username novo and user id %s", claims, resp.UserID)
	}
}
