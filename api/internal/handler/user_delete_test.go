package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/bolao-app/api/internal/auth"
	"github.com/bolao-app/api/internal/models"
	"github.com/bolao-app/api/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type fakeDeletionStore struct {
	fakeUserStore
	blockers  []models.DeletionBlocker
	newOwners map[uuid.UUID]uuid.UUID
	deleted   bool
}

func (f *fakeDeletionStore) DeletionBlockers(context.Context, uuid.UUID) ([]models.DeletionBlocker, error) {
	return f.blockers, nil
}

func (f *fakeDeletionStore) DeleteAccount(_ context.Context, _ uuid.UUID, newOwners map[uuid.UUID]uuid.UUID) error {
	f.newOwners = newOwners
	for _, b := range f.blockers {
		if _, ok := newOwners[b.BolaoID]; !ok {
			return &repository.OwnershipBlockedError{Blockers: f.blockers}
		}
	}
	f.deleted = true
	return nil
}

func deletionRouter(t *testing.T, store *fakeDeletionStore) (*gin.Engine, map[string]string) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewUserHandler(store, nil)
	r.GET("/api/me/deletion-check", AuthMiddleware(testJWTSecret), h.DeletionCheck)
	r.DELETE("/api/me", AuthMiddleware(testJWTSecret), h.DeleteMe)
	token, err := auth.GenerateToken(store.user.ID, store.user.Username, false, testJWTSecret)
	if err != nil {
		t.Fatal(err)
	}
	return r, map[string]string{"Authorization": "Bearer " + token}
}

func blockerFixture() (models.DeletionBlocker, uuid.UUID) {
	admin := uuid.New()
	return models.DeletionBlocker{
		BolaoID:          uuid.New(),
		BolaoName:        "Firma",
		SuggestedOwnerID: admin,
		Members:          []models.DeletionCandidate{{UserID: admin, DisplayName: "Ana", Role: models.MemberRoleAdmin}},
	}, admin
}

func TestDeletionCheckListsTheBolõesThatNeedANewOwner(t *testing.T) {
	b, admin := blockerFixture()
	store := &fakeDeletionStore{fakeUserStore: fakeUserStore{user: &models.User{ID: uuid.New(), Username: "dono"}}, blockers: []models.DeletionBlocker{b}}
	r, headers := deletionRouter(t, store)

	w := do(t, r, http.MethodGet, "/api/me/deletion-check", "", headers)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var got struct {
		Blockers []models.DeletionBlocker `json:"blockers"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Blockers) != 1 || got.Blockers[0].SuggestedOwnerID != admin || got.Blockers[0].BolaoName != "Firma" {
		t.Errorf("blockers = %+v", got.Blockers)
	}
}

func TestDeleteMeHandsOverEachBolãoToTheChosenOwner(t *testing.T) {
	b, admin := blockerFixture()
	store := &fakeDeletionStore{fakeUserStore: fakeUserStore{user: &models.User{ID: uuid.New(), Username: "dono"}}, blockers: []models.DeletionBlocker{b}}
	r, headers := deletionRouter(t, store)

	body := `{"new_owners":{"` + b.BolaoID.String() + `":"` + admin.String() + `"}}`
	w := do(t, r, http.MethodDelete, "/api/me", body, headers)

	if w.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204: %s", w.Code, w.Body.String())
	}
	if !store.deleted || store.newOwners[b.BolaoID] != admin {
		t.Errorf("deleted = %v newOwners = %v", store.deleted, store.newOwners)
	}
}

func TestDeleteMeWithoutANewOwnerReturnsTheBlockers(t *testing.T) {
	b, _ := blockerFixture()
	store := &fakeDeletionStore{fakeUserStore: fakeUserStore{user: &models.User{ID: uuid.New(), Username: "dono"}}, blockers: []models.DeletionBlocker{b}}
	r, headers := deletionRouter(t, store)

	w := do(t, r, http.MethodDelete, "/api/me", "", headers)

	if w.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409", w.Code)
	}
	var got struct {
		Error    string                   `json:"error"`
		Blockers []models.DeletionBlocker `json:"blockers"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Error == "" || len(got.Blockers) != 1 || store.deleted {
		t.Errorf("body = %+v deleted = %v", got, store.deleted)
	}
}

func TestDeleteMeRejectsAMalformedNewOwnersBody(t *testing.T) {
	store := &fakeDeletionStore{fakeUserStore: fakeUserStore{user: &models.User{ID: uuid.New(), Username: "dono"}}}
	r, headers := deletionRouter(t, store)

	w := do(t, r, http.MethodDelete, "/api/me", `{"new_owners":{"x":"y"}}`, headers)

	if w.Code != http.StatusBadRequest || store.deleted {
		t.Errorf("status = %d deleted = %v, want 400 and no delete", w.Code, store.deleted)
	}
}
