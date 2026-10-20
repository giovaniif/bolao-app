package handler

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/bolao-app/api/internal/models"
	"github.com/bolao-app/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type fakePublicBoloes struct {
	fakeBolaoStore
	owned  int
	hidden []uuid.UUID
	search string
}

func (f *fakePublicBoloes) ListPublic(_ context.Context, search string, _ int) ([]models.PublicBolao, error) {
	f.search = search
	return []models.PublicBolao{{ID: f.bolao.ID, Name: f.bolao.Name, MemberCount: 3, MaxMembers: 50}}, nil
}

func (f *fakePublicBoloes) SetHidden(_ context.Context, id uuid.UUID, _ bool) error {
	f.hidden = append(f.hidden, id)
	return nil
}

func (f *fakePublicBoloes) CountOwnedActive(context.Context, uuid.UUID) (int, error) {
	return f.owned, nil
}

func publicRouter(store *fakeMemberStore, boloes *fakePublicBoloes) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	api := r.Group("/api", AuthMiddleware(testJWTSecret))
	NewPublicBolaoHandler(store, boloes).Routes(api, api.Group("", AdminMiddleware()))
	NewMemberHandler(store, boloes).Routes(api, RequireMember(store))
	return r
}

func publicFixture(visibility string, approval bool) (*fakeMemberStore, *fakePublicBoloes) {
	id := uuid.New()
	boloes := &fakePublicBoloes{fakeBolaoStore: fakeBolaoStore{bolao: models.Bolao{ID: id, Name: "Aberto", Status: "active", Visibility: visibility, RequiresApproval: approval, MaxMembers: 50}}}
	return newFakeMemberStore(id), boloes
}

func TestPublicBolaoHandler_ListAndJoin(t *testing.T) {
	store, boloes := publicFixture("public", false)
	r := publicRouter(store, boloes)
	user := uuid.New()

	w := do(t, r, http.MethodGet, "/api/boloes/public?q=abe", "", tokenFor(t, user, false))
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"name":"Aberto"`) || boloes.search != "abe" {
		t.Errorf("list: status = %d body = %s search = %q", w.Code, w.Body, boloes.search)
	}
	w = do(t, r, http.MethodPost, "/api/boloes/"+boloes.bolao.ID.String()+"/join", "", tokenFor(t, user, false))
	if w.Code != http.StatusOK || store.statuses[user] != models.MemberStatusActive {
		t.Errorf("join: status = %d member = %q", w.Code, store.statuses[user])
	}
}

func TestPublicBolaoHandler_APrivateBolaoCannotBeJoinedFromTheListing(t *testing.T) {
	store, boloes := publicFixture("private", false)
	w := do(t, publicRouter(store, boloes), http.MethodPost, "/api/boloes/"+boloes.bolao.ID.String()+"/join", "", tokenFor(t, uuid.New(), false))
	if w.Code != http.StatusConflict || !strings.Contains(w.Body.String(), "não é público") {
		t.Errorf("status = %d body = %s, want 409", w.Code, w.Body)
	}
}

func TestPublicBolaoHandler_OnlyThePlatformAdminHides(t *testing.T) {
	store, boloes := publicFixture("public", false)
	r := publicRouter(store, boloes)
	path := "/api/boloes/" + boloes.bolao.ID.String() + "/hidden"

	if w := do(t, r, http.MethodPut, path, `{"hidden":true}`, tokenFor(t, uuid.New(), false)); w.Code != http.StatusForbidden {
		t.Errorf("user: status = %d, want 403", w.Code)
	}
	if w := do(t, r, http.MethodPut, path, `{"hidden":true}`, tokenFor(t, uuid.New(), true)); w.Code != http.StatusOK || len(boloes.hidden) != 1 {
		t.Errorf("platform admin: status = %d hidden = %v", w.Code, boloes.hidden)
	}
}

func TestMemberHandler_CreateStopsAtTheOwnedLimit(t *testing.T) {
	store, boloes := publicFixture("public", false)
	boloes.owned = service.MaxOwnedActiveBoloes
	w := do(t, publicRouter(store, boloes), http.MethodPost, "/api/me/boloes", `{"name":"Mais um"}`, tokenFor(t, uuid.New(), false))
	if w.Code != http.StatusConflict || len(boloes.created) != 0 {
		t.Errorf("status = %d created = %v, want 409 and nothing created", w.Code, boloes.created)
	}
}
