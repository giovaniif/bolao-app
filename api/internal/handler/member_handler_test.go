package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/bolao-app/api/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type fakeMemberStore struct {
	fakeMemberships
	bolaoID   uuid.UUID
	statuses  map[uuid.UUID]string
	roles     map[uuid.UUID]string
	transfers [][2]uuid.UUID
	active    int
}

func newFakeMemberStore(bolaoID uuid.UUID) *fakeMemberStore {
	return &fakeMemberStore{fakeMemberships: fakeMemberships{}, bolaoID: bolaoID, statuses: map[uuid.UUID]string{}, roles: map[uuid.UUID]string{}}
}

func (f *fakeMemberStore) with(user uuid.UUID, role, status string) *fakeMemberStore {
	f.fakeMemberships[user] = &models.Membership{BolaoID: f.bolaoID, UserID: user, Role: role, Status: status}
	if status == models.MemberStatusActive {
		f.active++
	}
	return f
}

func (f *fakeMemberStore) Add(_ context.Context, _ uuid.UUID, user uuid.UUID, role, status string) error {
	f.roles[user], f.statuses[user] = role, status
	return nil
}

func (f *fakeMemberStore) SetStatus(_ context.Context, _ uuid.UUID, user uuid.UUID, status string) error {
	f.statuses[user] = status
	return nil
}

func (f *fakeMemberStore) SetRole(_ context.Context, _ uuid.UUID, user uuid.UUID, role string) error {
	f.roles[user] = role
	return nil
}

func (f *fakeMemberStore) TransferOwnership(_ context.Context, _ uuid.UUID, from, to uuid.UUID) error {
	f.transfers = append(f.transfers, [2]uuid.UUID{from, to})
	return nil
}

func (f *fakeMemberStore) CountActive(context.Context, uuid.UUID) (int, error) { return f.active, nil }

func (f *fakeMemberStore) ListByBolao(context.Context, uuid.UUID) ([]models.MemberView, error) {
	var out []models.MemberView
	for id, m := range f.fakeMemberships {
		out = append(out, models.MemberView{ID: id, Role: m.Role, Status: m.Status})
	}
	return out, nil
}

func (f *fakeMemberStore) ListBoloesOfUser(context.Context, uuid.UUID) ([]models.MyBolao, error) {
	return []models.MyBolao{{Bolao: models.Bolao{ID: f.bolaoID, Name: "Amigos"}, Role: models.MemberRoleOwner}}, nil
}

type fakeBolaoStore struct {
	bolao    models.Bolao
	created  []string
	settings []string
}

func (f *fakeBolaoStore) GetByID(context.Context, uuid.UUID) (*models.Bolao, error) {
	b := f.bolao
	return &b, nil
}

func (f *fakeBolaoStore) CreateOwned(_ context.Context, name string, owner uuid.UUID) (*models.Bolao, error) {
	f.created = append(f.created, name)
	return &models.Bolao{ID: uuid.New(), Name: name, Status: "active", OwnerID: &owner}, nil
}

func (f *fakeBolaoStore) UpdateSettings(_ context.Context, _ uuid.UUID, name, visibility string, approval bool) error {
	f.settings = append(f.settings, name+"|"+visibility)
	return nil
}

func memberHandlerRouter(store *fakeMemberStore, boloes *fakeBolaoStore) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	api := r.Group("/api", AuthMiddleware(testJWTSecret))
	h := NewMemberHandler(store, boloes)
	h.Routes(api, RequireMember(store))
	return r
}

func activeBolao(id uuid.UUID) *fakeBolaoStore {
	return &fakeBolaoStore{bolao: models.Bolao{ID: id, Name: "Amigos", Status: "active", Visibility: "private", RequiresApproval: true, MaxMembers: 50}}
}

func TestMemberHandler_CreateAndListMyBoloes(t *testing.T) {
	bolaoID, user := uuid.New(), uuid.New()
	boloes := activeBolao(bolaoID)
	r := memberHandlerRouter(newFakeMemberStore(bolaoID), boloes)

	w := do(t, r, http.MethodPost, "/api/me/boloes", `{"name":"Bolão da firma"}`, tokenFor(t, user, false))
	if w.Code != http.StatusCreated || len(boloes.created) != 1 || !strings.Contains(w.Body.String(), user.String()) {
		t.Errorf("create: status = %d body = %s", w.Code, w.Body)
	}
	if w := do(t, r, http.MethodPost, "/api/me/boloes", `{"name":"ab"}`, tokenFor(t, user, false)); w.Code != http.StatusBadRequest {
		t.Errorf("short name: status = %d, want 400", w.Code)
	}
	w = do(t, r, http.MethodGet, "/api/me/boloes", "", tokenFor(t, user, false))
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"role":"owner"`) {
		t.Errorf("list: status = %d body = %s", w.Code, w.Body)
	}
}

func TestMemberHandler_UpdateSettings(t *testing.T) {
	bolaoID, owner, admin := uuid.New(), uuid.New(), uuid.New()
	store := newFakeMemberStore(bolaoID).with(owner, models.MemberRoleOwner, models.MemberStatusActive).with(admin, models.MemberRoleAdmin, models.MemberStatusActive)
	boloes := activeBolao(bolaoID)
	r := memberHandlerRouter(store, boloes)
	path := "/api/boloes/" + bolaoID.String()

	if w := do(t, r, http.MethodPatch, path, `{"name":"Novo nome","visibility":"public","requires_approval":false}`, tokenFor(t, owner, false)); w.Code != http.StatusOK || len(boloes.settings) != 1 || boloes.settings[0] != "Novo nome|public" {
		t.Errorf("owner: status = %d settings = %v", w.Code, boloes.settings)
	}
	if w := do(t, r, http.MethodPatch, path, `{"name":"Novo nome","visibility":"secret","requires_approval":false}`, tokenFor(t, owner, false)); w.Code != http.StatusBadRequest {
		t.Errorf("bad visibility: status = %d, want 400", w.Code)
	}
	if w := do(t, r, http.MethodPatch, path, `{"name":"Outro","visibility":"public","requires_approval":false}`, tokenFor(t, admin, false)); w.Code != http.StatusForbidden {
		t.Errorf("admin: status = %d, want 403", w.Code)
	}
}

func TestMemberHandler_ListMembersHidesRequestsFromParticipants(t *testing.T) {
	bolaoID, owner, participant, pending := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	store := newFakeMemberStore(bolaoID).with(owner, models.MemberRoleOwner, models.MemberStatusActive).with(participant, models.MemberRoleParticipant, models.MemberStatusActive).with(pending, models.MemberRoleParticipant, models.MemberStatusPending)
	r := memberHandlerRouter(store, activeBolao(bolaoID))
	path := "/api/boloes/" + bolaoID.String() + "/members"

	count := func(user uuid.UUID) int {
		w := do(t, r, http.MethodGet, path, "", tokenFor(t, user, false))
		var members []models.MemberView
		if err := json.Unmarshal(w.Body.Bytes(), &members); err != nil {
			t.Fatalf("decode: %v (%s)", err, w.Body)
		}
		return len(members)
	}
	if got := count(owner); got != 3 {
		t.Errorf("owner sees %d members, want 3 with the request", got)
	}
	if got := count(participant); got != 2 {
		t.Errorf("participant sees %d members, want 2 without the request", got)
	}
}

func TestMemberHandler_ReviewRequests(t *testing.T) {
	bolaoID, admin, pending, participant := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	store := newFakeMemberStore(bolaoID).with(admin, models.MemberRoleAdmin, models.MemberStatusActive).with(pending, models.MemberRoleParticipant, models.MemberStatusPending).with(participant, models.MemberRoleParticipant, models.MemberStatusActive)
	r := memberHandlerRouter(store, activeBolao(bolaoID))
	base := "/api/boloes/" + bolaoID.String() + "/members/"

	if w := do(t, r, http.MethodPost, base+pending.String()+"/approve", "", tokenFor(t, admin, false)); w.Code != http.StatusOK || store.statuses[pending] != models.MemberStatusActive {
		t.Errorf("approve: status = %d member = %q", w.Code, store.statuses[pending])
	}
	if w := do(t, r, http.MethodPost, base+participant.String()+"/approve", "", tokenFor(t, admin, false)); w.Code != http.StatusConflict {
		t.Errorf("approve an active member: status = %d, want 409", w.Code)
	}
	if w := do(t, r, http.MethodPost, base+pending.String()+"/reject", "", tokenFor(t, participant, false)); w.Code != http.StatusForbidden {
		t.Errorf("participant rejects: status = %d, want 403", w.Code)
	}
	if w := do(t, r, http.MethodPost, base+uuid.NewString()+"/approve", "", tokenFor(t, admin, false)); w.Code != http.StatusNotFound {
		t.Errorf("unknown member: status = %d, want 404", w.Code)
	}
}

func TestMemberHandler_ApproveRefusesWhenFull(t *testing.T) {
	bolaoID, admin, pending := uuid.New(), uuid.New(), uuid.New()
	store := newFakeMemberStore(bolaoID).with(admin, models.MemberRoleAdmin, models.MemberStatusActive).with(pending, models.MemberRoleParticipant, models.MemberStatusPending)
	store.active = 50
	r := memberHandlerRouter(store, activeBolao(bolaoID))

	w := do(t, r, http.MethodPost, "/api/boloes/"+bolaoID.String()+"/members/"+pending.String()+"/approve", "", tokenFor(t, admin, false))
	if w.Code != http.StatusConflict || !strings.Contains(w.Body.String(), "máximo") {
		t.Errorf("status = %d body = %s, want 409 with the limit message", w.Code, w.Body)
	}
}

func TestMemberHandler_RolesRemovalAndLeaving(t *testing.T) {
	bolaoID, owner, admin, participant := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	store := newFakeMemberStore(bolaoID).with(owner, models.MemberRoleOwner, models.MemberStatusActive).with(admin, models.MemberRoleAdmin, models.MemberStatusActive).with(participant, models.MemberRoleParticipant, models.MemberStatusActive)
	r := memberHandlerRouter(store, activeBolao(bolaoID))
	base := "/api/boloes/" + bolaoID.String()

	if w := do(t, r, http.MethodPut, base+"/members/"+participant.String()+"/role", `{"role":"admin"}`, tokenFor(t, owner, false)); w.Code != http.StatusOK || store.roles[participant] != models.MemberRoleAdmin {
		t.Errorf("promote: status = %d role = %q", w.Code, store.roles[participant])
	}
	if w := do(t, r, http.MethodPut, base+"/members/"+admin.String()+"/role", `{"role":"owner"}`, tokenFor(t, owner, false)); w.Code != http.StatusOK || len(store.transfers) != 1 || store.transfers[0] != [2]uuid.UUID{owner, admin} {
		t.Errorf("hand over: status = %d transfers = %v", w.Code, store.transfers)
	}
	if w := do(t, r, http.MethodDelete, base+"/members/"+admin.String(), "", tokenFor(t, admin, false)); w.Code != http.StatusForbidden {
		t.Errorf("admin removes admin: status = %d, want 403", w.Code)
	}
	if w := do(t, r, http.MethodDelete, base+"/members/"+participant.String(), "", tokenFor(t, admin, false)); w.Code != http.StatusOK || store.statuses[participant] != models.MemberStatusRemoved {
		t.Errorf("admin removes participant: status = %d member = %q", w.Code, store.statuses[participant])
	}
	if w := do(t, r, http.MethodPost, base+"/leave", "", tokenFor(t, owner, false)); w.Code != http.StatusConflict {
		t.Errorf("owner leaves: status = %d, want 409", w.Code)
	}
	if w := do(t, r, http.MethodPost, base+"/leave", "", tokenFor(t, admin, false)); w.Code != http.StatusOK || store.statuses[admin] != models.MemberStatusRemoved {
		t.Errorf("admin leaves: status = %d member = %q", w.Code, store.statuses[admin])
	}
}
