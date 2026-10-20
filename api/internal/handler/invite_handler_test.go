package handler

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/bolao-app/api/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const testLinkToken = "abcdefghijklmnopqrstuvwx"

type fakeInvites struct {
	bolao      models.Bolao
	linkUses   int
	linkClosed bool
	rotated    int
	links      int
}

func (f *fakeInvites) FindByCode(_ context.Context, code string) (*models.Bolao, error) {
	if strings.ToUpper(strings.TrimSpace(code)) != f.bolao.InviteCode {
		return nil, errors.New("no rows")
	}
	b := f.bolao
	return &b, nil
}

func (f *fakeInvites) FindLink(_ context.Context, token string) (uuid.UUID, error) {
	if token != testLinkToken {
		return uuid.UUID{}, errors.New("no rows")
	}
	return f.bolao.ID, nil
}

func (f *fakeInvites) UseLink(_ context.Context, token string, _ time.Time) (uuid.UUID, error) {
	if f.linkClosed {
		return uuid.UUID{}, repository.ErrInviteUnavailable
	}
	f.linkUses++
	return f.bolao.ID, nil
}

func (f *fakeInvites) CreateLink(context.Context, uuid.UUID, uuid.UUID, time.Time, *int) (string, error) {
	f.links++
	return testLinkToken, nil
}

func (f *fakeInvites) RotateCode(context.Context, uuid.UUID) (string, error) {
	f.rotated++
	return "NEWCODE9", nil
}

func inviteRouter(invites *fakeInvites, store *fakeMemberStore) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	boloes := &fakeBolaoStore{bolao: invites.bolao}
	h := NewInviteHandler(invites, store, boloes)
	api := r.Group("/api")
	h.PublicRoutes(api)
	authed := api.Group("", AuthMiddleware(testJWTSecret))
	h.Routes(authed, RequireMember(store))
	return r
}

func inviteFixture(requiresApproval bool) (*fakeInvites, *fakeMemberStore, uuid.UUID) {
	bolaoID, owner := uuid.New(), uuid.New()
	invites := &fakeInvites{bolao: models.Bolao{ID: bolaoID, Name: "Amigos", Status: "active", Visibility: "private", RequiresApproval: requiresApproval, MaxMembers: 50, InviteCode: "AMIGOS22"}}
	store := newFakeMemberStore(bolaoID).with(owner, models.MemberRoleOwner, models.MemberStatusActive)
	return invites, store, owner
}

func TestInviteHandler_PreviewNeedsNoLogin(t *testing.T) {
	invites, store, _ := inviteFixture(true)
	r := inviteRouter(invites, store)

	w := do(t, r, http.MethodGet, "/api/invites/amigos22", "", nil)
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"name":"Amigos"`) || !strings.Contains(w.Body.String(), `"joins":"request"`) {
		t.Errorf("code preview: status = %d body = %s", w.Code, w.Body)
	}
	if strings.Contains(w.Body.String(), "AMIGOS22") {
		t.Errorf("preview leaks the code: %s", w.Body)
	}
	w = do(t, r, http.MethodGet, "/api/invites/"+testLinkToken, "", nil)
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"joins":"direct"`) {
		t.Errorf("link preview: status = %d body = %s", w.Code, w.Body)
	}
	if w := do(t, r, http.MethodGet, "/api/invites/NOPE1234", "", nil); w.Code != http.StatusNotFound {
		t.Errorf("unknown code: status = %d, want 404", w.Code)
	}
}

func TestInviteHandler_JoinByCode(t *testing.T) {
	invites, store, _ := inviteFixture(true)
	r := inviteRouter(invites, store)
	user := uuid.New()

	w := do(t, r, http.MethodPost, "/api/invites/AMIGOS22/join", "", tokenFor(t, user, false))
	if w.Code != http.StatusOK || store.statuses[user] != models.MemberStatusPending || store.roles[user] != models.MemberRoleParticipant {
		t.Errorf("status = %d member = %q/%q body = %s, want a pending request", w.Code, store.roles[user], store.statuses[user], w.Body)
	}
	if w := do(t, r, http.MethodPost, "/api/invites/AMIGOS22/join", "", nil); w.Code != http.StatusUnauthorized {
		t.Errorf("without login: status = %d, want 401", w.Code)
	}
}

func TestInviteHandler_JoinByLinkSkipsApprovalAndCountsAUse(t *testing.T) {
	invites, store, _ := inviteFixture(true)
	r := inviteRouter(invites, store)
	user := uuid.New()

	w := do(t, r, http.MethodPost, "/api/invites/"+testLinkToken+"/join", "", tokenFor(t, user, false))
	if w.Code != http.StatusOK || store.statuses[user] != models.MemberStatusActive || invites.linkUses != 1 {
		t.Errorf("status = %d member = %q uses = %d, want active and one use", w.Code, store.statuses[user], invites.linkUses)
	}
}

func TestInviteHandler_ARefusedJoinDoesNotUseTheLink(t *testing.T) {
	invites, store, owner := inviteFixture(true)
	r := inviteRouter(invites, store)

	w := do(t, r, http.MethodPost, "/api/invites/"+testLinkToken+"/join", "", tokenFor(t, owner, false))
	if w.Code != http.StatusConflict || invites.linkUses != 0 {
		t.Errorf("status = %d uses = %d, want 409 and no use", w.Code, invites.linkUses)
	}
}

func TestInviteHandler_AnExpiredLinkIsRefused(t *testing.T) {
	invites, store, _ := inviteFixture(false)
	invites.linkClosed = true
	r := inviteRouter(invites, store)

	w := do(t, r, http.MethodPost, "/api/invites/"+testLinkToken+"/join", "", tokenFor(t, uuid.New(), false))
	if w.Code != http.StatusGone {
		t.Errorf("status = %d, want 410", w.Code)
	}
}

func TestInviteHandler_ManagersShareAndRotate(t *testing.T) {
	invites, store, owner := inviteFixture(true)
	participant := uuid.New()
	store.with(participant, models.MemberRoleParticipant, models.MemberStatusActive)
	r := inviteRouter(invites, store)
	base := "/api/boloes/" + invites.bolao.ID.String() + "/invite"

	if w := do(t, r, http.MethodGet, base, "", tokenFor(t, owner, false)); w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"code":"AMIGOS22"`) {
		t.Errorf("owner reads the code: status = %d body = %s", w.Code, w.Body)
	}
	if w := do(t, r, http.MethodGet, base, "", tokenFor(t, participant, false)); w.Code != http.StatusForbidden {
		t.Errorf("participant reads the code: status = %d, want 403", w.Code)
	}
	if w := do(t, r, http.MethodPost, base+"/links", "", tokenFor(t, owner, false)); w.Code != http.StatusCreated || invites.links != 1 || !strings.Contains(w.Body.String(), testLinkToken) {
		t.Errorf("create link: status = %d body = %s", w.Code, w.Body)
	}
	if w := do(t, r, http.MethodPost, base+"/rotate", "", tokenFor(t, owner, false)); w.Code != http.StatusOK || invites.rotated != 1 || !strings.Contains(w.Body.String(), "NEWCODE9") {
		t.Errorf("rotate: status = %d body = %s", w.Code, w.Body)
	}
}
