package handler

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/bolao-app/api/internal/auth"
	"github.com/bolao-app/api/internal/models"
	"github.com/bolao-app/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	testJWTSecret  = "test-secret"
	testCronSecret = "cron-secret"
)

var (
	testBolaoID = uuid.New()
	testNow     = time.Date(2026, 10, 18, 18, 55, 0, 0, time.UTC)
)

type fakePushStore struct {
	upserted      []models.PushSubscription
	deleted       []string
	expoTokens    []models.ExpoPushToken
	deletedTokens []string
}

func (f *fakePushStore) Upsert(_ context.Context, s *models.PushSubscription) error {
	f.upserted = append(f.upserted, *s)
	return nil
}

func (f *fakePushStore) DeleteForUser(_ context.Context, _ uuid.UUID, endpoint string) error {
	f.deleted = append(f.deleted, endpoint)
	return nil
}

func (f *fakePushStore) UpsertExpoToken(_ context.Context, t *models.ExpoPushToken) error {
	f.expoTokens = append(f.expoTokens, *t)
	return nil
}

func (f *fakePushStore) DeleteExpoTokenForUser(_ context.Context, _ uuid.UUID, token string) error {
	f.deletedTokens = append(f.deletedTokens, token)
	return nil
}

type fakeBolaos struct {
	err    error
	active []models.Bolao
}

func (f fakeBolaos) ListActive(context.Context) ([]models.Bolao, error) {
	if f.err != nil {
		return nil, f.err
	}
	if f.active != nil {
		return f.active, nil
	}
	return []models.Bolao{{ID: testBolaoID}}, nil
}

type fakeMatches struct{ matches []models.Match }

func (f fakeMatches) ListAllByBolao(context.Context, uuid.UUID) ([]models.Match, error) {
	return f.matches, nil
}

type fakeNotifier struct {
	mu         sync.Mutex
	notified   []service.Reminder
	notifiedTo []service.Audience
	tickedFor  []service.RoundClose
	tickedTo   []service.Audience
	done       chan struct{}
}

func (f *fakeNotifier) Notify(_ context.Context, a service.Audience, r service.Reminder) (int, error) {
	f.mu.Lock()
	f.notified = append(f.notified, r)
	f.notifiedTo = append(f.notifiedTo, a)
	f.mu.Unlock()
	if f.done != nil {
		f.done <- struct{}{}
	}
	return 1, nil
}

func (f *fakeNotifier) Tick(_ context.Context, a service.Audience, rounds []service.RoundClose, _ time.Time) (int, error) {
	f.tickedFor = rounds
	f.tickedTo = append(f.tickedTo, a)
	return 3, nil
}

func newTestPushHandler(store *fakePushStore, notifier *fakeNotifier, matches []models.Match) *PushHandler {
	var n RoundNotifier
	if notifier != nil {
		n = notifier
	}
	h := NewPushHandler(store, fakeBolaos{}, fakeMatches{matches}, n, nil, "public-key", testCronSecret)
	h.now = func() time.Time { return testNow }
	return h
}

func pushRouter(h *PushHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/push/public-key", h.PublicKey)
	r.POST("/api/internal/notifications/tick", h.Tick)
	api := r.Group("/api", AuthMiddleware(testJWTSecret))
	api.POST("/push/subscriptions", h.Subscribe)
	api.DELETE("/push/subscriptions", h.Unsubscribe)
	api.POST("/push/expo-tokens", h.RegisterExpoToken)
	api.DELETE("/push/expo-tokens", h.UnregisterExpoToken)
	return r
}

func do(t *testing.T, r *gin.Engine, method, path, body string, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func bearer(t *testing.T) map[string]string {
	t.Helper()
	token, err := auth.GenerateToken(uuid.New(), "maria", false, testJWTSecret)
	if err != nil {
		t.Fatal(err)
	}
	return map[string]string{"Authorization": "Bearer " + token}
}

const validSubscription = `{"endpoint":"https://fcm.googleapis.com/fcm/send/abc","keys":{"p256dh":"k","auth":"a"}}`

func TestPushHandlerSubscribe(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		headers    func(*testing.T) map[string]string
		disabled   bool
		wantStatus int
		wantStored int
	}{
		{"valid subscription is stored", validSubscription, bearer, false, http.StatusNoContent, 1},
		{"unauthenticated is rejected", validSubscription, func(*testing.T) map[string]string { return nil }, false, http.StatusUnauthorized, 0},
		{"missing keys is a bad request", `{"endpoint":"https://push.example/x"}`, bearer, false, http.StatusBadRequest, 0},
		{"non-URL endpoint is a bad request", `{"endpoint":"nope","keys":{"p256dh":"k","auth":"a"}}`, bearer, false, http.StatusBadRequest, 0},
		{"push disabled refuses subscriptions", validSubscription, bearer, true, http.StatusServiceUnavailable, 0},
	}
	for _, tt := range tests {
		store := &fakePushStore{}
		notifier := &fakeNotifier{}
		if tt.disabled {
			notifier = nil
		}
		r := pushRouter(newTestPushHandler(store, notifier, nil))
		w := do(t, r, http.MethodPost, "/api/push/subscriptions", tt.body, tt.headers(t))
		if w.Code != tt.wantStatus {
			t.Errorf("%s: status = %d, want %d (%s)", tt.name, w.Code, tt.wantStatus, w.Body)
		}
		if len(store.upserted) != tt.wantStored {
			t.Errorf("%s: stored = %d, want %d", tt.name, len(store.upserted), tt.wantStored)
		}
	}
}

func TestPushHandlerUnsubscribe(t *testing.T) {
	store := &fakePushStore{}
	r := pushRouter(newTestPushHandler(store, &fakeNotifier{}, nil))

	if w := do(t, r, http.MethodDelete, "/api/push/subscriptions", `{}`, bearer(t)); w.Code != http.StatusBadRequest {
		t.Errorf("missing endpoint: status = %d, want 400", w.Code)
	}
	if w := do(t, r, http.MethodDelete, "/api/push/subscriptions", `{"endpoint":"https://push.example/x"}`, bearer(t)); w.Code != http.StatusNoContent {
		t.Errorf("unsubscribe: status = %d, want 204", w.Code)
	}
	if len(store.deleted) != 1 {
		t.Errorf("deleted = %v, want one endpoint", store.deleted)
	}
}

func TestPushHandlerPublicKey(t *testing.T) {
	w := do(t, pushRouter(newTestPushHandler(&fakePushStore{}, &fakeNotifier{}, nil)), http.MethodGet, "/api/push/public-key", "", nil)
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"public_key":"public-key"`) {
		t.Errorf("enabled: %d %s", w.Code, w.Body)
	}
	w = do(t, pushRouter(newTestPushHandler(&fakePushStore{}, nil, nil)), http.MethodGet, "/api/push/public-key", "", nil)
	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("disabled: status = %d, want 503", w.Code)
	}
}

func TestPushHandlerTick(t *testing.T) {
	closes := testNow.Add(5 * time.Minute)
	matches := []models.Match{{Round: 7, MarketClosesAt: &closes}}
	tests := []struct {
		name       string
		secret     string
		wantStatus int
		wantTick   bool
	}{
		{"missing secret is unauthorized", "", http.StatusUnauthorized, false},
		{"wrong secret is unauthorized", "guess", http.StatusUnauthorized, false},
		{"correct secret runs the tick", testCronSecret, http.StatusOK, true},
	}
	for _, tt := range tests {
		notifier := &fakeNotifier{}
		r := pushRouter(newTestPushHandler(&fakePushStore{}, notifier, matches))
		w := do(t, r, http.MethodPost, "/api/internal/notifications/tick", "", map[string]string{"X-Cron-Secret": tt.secret})
		if w.Code != tt.wantStatus {
			t.Errorf("%s: status = %d, want %d", tt.name, w.Code, tt.wantStatus)
		}
		if ticked := notifier.tickedFor != nil; ticked != tt.wantTick {
			t.Errorf("%s: ticked = %v, want %v", tt.name, ticked, tt.wantTick)
		}
		if tt.wantTick && (len(notifier.tickedFor) != 1 || notifier.tickedFor[0].Round != 7 || !strings.Contains(w.Body.String(), `"sent":3`)) {
			t.Errorf("%s: rounds = %+v, body = %s", tt.name, notifier.tickedFor, w.Body)
		}
	}
}

func TestPushHandlerTickWithoutSecretConfigured(t *testing.T) {
	h := NewPushHandler(&fakePushStore{}, fakeBolaos{}, fakeMatches{}, &fakeNotifier{}, nil, "public-key", "")
	w := do(t, pushRouter(h), http.MethodPost, "/api/internal/notifications/tick", "", map[string]string{"X-Cron-Secret": ""})
	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401: an unset secret must not open the endpoint", w.Code)
	}
}

func TestPushHandlerTickWithoutActiveBolao(t *testing.T) {
	notifier := &fakeNotifier{}
	h := NewPushHandler(&fakePushStore{}, fakeBolaos{err: errors.New("no rows")}, fakeMatches{}, notifier, nil, "public-key", testCronSecret)
	w := do(t, pushRouter(h), http.MethodPost, "/api/internal/notifications/tick", "", map[string]string{"X-Cron-Secret": testCronSecret})
	if w.Code != http.StatusOK || notifier.tickedFor != nil {
		t.Errorf("status = %d, ticked = %v; want a quiet 200", w.Code, notifier.tickedFor != nil)
	}
}

func TestPushHandlerAnnounceRound(t *testing.T) {
	future := testNow.Add(48 * time.Hour)
	past := testNow.Add(-time.Hour)
	tests := []struct {
		name     string
		closesAt *time.Time
		want     bool
	}{
		{"a round with a future deadline is announced", &future, true},
		{"a round without a deadline waits", nil, false},
		{"a round already closed is not announced", &past, false},
	}
	for _, tt := range tests {
		notifier := &fakeNotifier{done: make(chan struct{}, 1)}
		newTestPushHandler(&fakePushStore{}, notifier, nil).AnnounceRound(models.Bolao{ID: testBolaoID}, 7, tt.closesAt)

		select {
		case <-notifier.done:
			if !tt.want {
				t.Errorf("%s: announced, want silence", tt.name)
			} else if notifier.notified[0].Kind != service.ReminderNewRound || notifier.notified[0].Round != 7 {
				t.Errorf("%s: got %+v", tt.name, notifier.notified[0])
			}
		case <-time.After(200 * time.Millisecond):
			if tt.want {
				t.Errorf("%s: not announced", tt.name)
			}
		}
	}
}

const validExpoToken = `{"token":"ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]","platform":"ios"}`

func TestPushHandlerRegisterExpoToken(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		headers    func(*testing.T) map[string]string
		disabled   bool
		wantStatus int
		wantStored int
	}{
		{"a valid token is stored", validExpoToken, bearer, false, http.StatusNoContent, 1},
		{"an android token is stored", `{"token":"ExpoPushToken[abc]","platform":"android"}`, bearer, false, http.StatusNoContent, 1},
		{"unauthenticated is rejected", validExpoToken, func(*testing.T) map[string]string { return nil }, false, http.StatusUnauthorized, 0},
		{"a missing token is a bad request", `{"platform":"ios"}`, bearer, false, http.StatusBadRequest, 0},
		{"a token that is not an Expo token is a bad request", `{"token":"abc","platform":"ios"}`, bearer, false, http.StatusBadRequest, 0},
		{"an unknown platform is a bad request", `{"token":"ExponentPushToken[abc]","platform":"web"}`, bearer, false, http.StatusBadRequest, 0},
		{"push disabled refuses tokens", validExpoToken, bearer, true, http.StatusServiceUnavailable, 0},
	}
	for _, tt := range tests {
		store := &fakePushStore{}
		notifier := &fakeNotifier{}
		if tt.disabled {
			notifier = nil
		}
		r := pushRouter(newTestPushHandler(store, notifier, nil))
		w := do(t, r, http.MethodPost, "/api/push/expo-tokens", tt.body, tt.headers(t))
		if w.Code != tt.wantStatus {
			t.Errorf("%s: status = %d, want %d (%s)", tt.name, w.Code, tt.wantStatus, w.Body)
		}
		if len(store.expoTokens) != tt.wantStored {
			t.Errorf("%s: stored = %d, want %d", tt.name, len(store.expoTokens), tt.wantStored)
		}
	}
}

func TestPushHandlerRegisterExpoTokenStoresTheUserAndPlatform(t *testing.T) {
	store := &fakePushStore{}
	userID := uuid.New()
	token, err := auth.GenerateToken(userID, "maria", false, testJWTSecret)
	if err != nil {
		t.Fatal(err)
	}
	do(t, pushRouter(newTestPushHandler(store, &fakeNotifier{}, nil)), http.MethodPost, "/api/push/expo-tokens", validExpoToken, map[string]string{"Authorization": "Bearer " + token})
	if len(store.expoTokens) != 1 {
		t.Fatalf("stored = %d, want 1", len(store.expoTokens))
	}
	got := store.expoTokens[0]
	if got.UserID != userID || got.Token != "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" || got.Platform != "ios" {
		t.Errorf("stored %+v, want the caller's ios token", got)
	}
}

func TestPushHandlerUnregisterExpoToken(t *testing.T) {
	store := &fakePushStore{}
	r := pushRouter(newTestPushHandler(store, &fakeNotifier{}, nil))

	if w := do(t, r, http.MethodDelete, "/api/push/expo-tokens", `{}`, bearer(t)); w.Code != http.StatusBadRequest {
		t.Errorf("missing token: status = %d, want 400", w.Code)
	}
	if w := do(t, r, http.MethodDelete, "/api/push/expo-tokens", `{"token":"ExponentPushToken[abc]"}`, nil); w.Code != http.StatusUnauthorized {
		t.Errorf("unauthenticated: status = %d, want 401", w.Code)
	}
	if w := do(t, r, http.MethodDelete, "/api/push/expo-tokens", `{"token":"ExponentPushToken[abc]"}`, bearer(t)); w.Code != http.StatusNoContent {
		t.Errorf("unregister: status = %d, want 204", w.Code)
	}
	if strings.Join(store.deletedTokens, ",") != "ExponentPushToken[abc]" {
		t.Errorf("deleted = %v, want the one token", store.deletedTokens)
	}
}

func TestPushHandlerExpoWorksWithoutVAPIDKeys(t *testing.T) {
	notifier := &fakeNotifier{}
	store := &fakePushStore{}
	h := NewPushHandler(store, fakeBolaos{}, fakeMatches{}, notifier, nil, "", testCronSecret)
	r := pushRouter(h)

	if w := do(t, r, http.MethodPost, "/api/push/subscriptions", validSubscription, bearer(t)); w.Code != http.StatusServiceUnavailable {
		t.Errorf("web subscribe without VAPID: status = %d, want 503", w.Code)
	}
	if w := do(t, r, http.MethodPost, "/api/push/expo-tokens", validExpoToken, bearer(t)); w.Code != http.StatusNoContent {
		t.Errorf("expo register without VAPID: status = %d, want 204", w.Code)
	}
	do(t, r, http.MethodPost, "/api/internal/notifications/tick", "", map[string]string{"X-Cron-Secret": testCronSecret})
	if len(notifier.tickedTo) != 1 {
		t.Errorf("ticks = %d, want the tick to run for Expo without VAPID", len(notifier.tickedTo))
	}
}

func TestPushHandlerTickCoversEveryActiveBolao(t *testing.T) {
	competition := uuid.New()
	first := models.Bolao{ID: uuid.New(), CompetitionID: &competition}
	second := models.Bolao{ID: uuid.New(), CompetitionID: &competition}
	notifier := &fakeNotifier{}
	h := NewPushHandler(&fakePushStore{}, fakeBolaos{active: []models.Bolao{first, second}}, fakeMatches{}, notifier, nil, "public-key", testCronSecret)

	w := do(t, pushRouter(h), http.MethodPost, "/api/internal/notifications/tick", "", map[string]string{"X-Cron-Secret": testCronSecret})
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"sent":6`) {
		t.Errorf("status = %d, body = %s; want both bolões counted", w.Code, w.Body)
	}
	want := []service.Audience{service.AudienceOf(first), service.AudienceOf(second)}
	if len(notifier.tickedTo) != 2 || notifier.tickedTo[0] != want[0] || notifier.tickedTo[1] != want[1] {
		t.Errorf("ticked for %+v, want %+v", notifier.tickedTo, want)
	}
}

func TestPushHandlerAnnounceRoundTargetsTheBolaoCompetition(t *testing.T) {
	competition := uuid.New()
	b := models.Bolao{ID: testBolaoID, CompetitionID: &competition}
	future := testNow.Add(48 * time.Hour)
	notifier := &fakeNotifier{done: make(chan struct{}, 1)}
	newTestPushHandler(&fakePushStore{}, notifier, nil).AnnounceRound(b, 7, &future)
	select {
	case <-notifier.done:
		if notifier.notifiedTo[0] != service.AudienceOf(b) {
			t.Errorf("announced to %+v, want %+v", notifier.notifiedTo[0], service.AudienceOf(b))
		}
	case <-time.After(time.Second):
		t.Fatal("not announced")
	}
}

type fakeSyncer struct {
	ran     chan struct{}
	release chan struct{}
}

func (f *fakeSyncer) RunOnce(context.Context) (service.SyncReport, error) {
	f.ran <- struct{}{}
	if f.release != nil {
		<-f.release
	}
	return service.SyncReport{Synced: 1}, nil
}

func TestPushHandlerTickRunsTheMatchSyncEvenWithoutPush(t *testing.T) {
	syncer := &fakeSyncer{ran: make(chan struct{}, 1)}
	h := NewPushHandler(&fakePushStore{}, fakeBolaos{}, fakeMatches{}, nil, syncer, "", testCronSecret)
	w := do(t, pushRouter(h), http.MethodPost, "/api/internal/notifications/tick", "", map[string]string{"X-Cron-Secret": testCronSecret})
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	select {
	case <-syncer.ran:
	case <-time.After(time.Second):
		t.Fatal("the match sync did not run")
	}
}

func TestPushHandlerTickWithAWrongSecretDoesNotSync(t *testing.T) {
	syncer := &fakeSyncer{ran: make(chan struct{}, 1)}
	h := NewPushHandler(&fakePushStore{}, fakeBolaos{}, fakeMatches{}, nil, syncer, "", testCronSecret)
	do(t, pushRouter(h), http.MethodPost, "/api/internal/notifications/tick", "", map[string]string{"X-Cron-Secret": "wrong"})
	select {
	case <-syncer.ran:
		t.Fatal("the match sync ran with a wrong secret")
	case <-time.After(50 * time.Millisecond):
	}
}

func TestPushHandlerTickSkipsASyncWhileOneRuns(t *testing.T) {
	syncer := &fakeSyncer{ran: make(chan struct{}, 2), release: make(chan struct{})}
	h := NewPushHandler(&fakePushStore{}, fakeBolaos{}, fakeMatches{}, nil, syncer, "", testCronSecret)
	h.syncWait = 10 * time.Millisecond
	r := pushRouter(h)
	headers := map[string]string{"X-Cron-Secret": testCronSecret}

	do(t, r, http.MethodPost, "/api/internal/notifications/tick", "", headers)
	<-syncer.ran
	do(t, r, http.MethodPost, "/api/internal/notifications/tick", "", headers)
	select {
	case <-syncer.ran:
		t.Fatal("a second sync started while the first one ran")
	case <-time.After(50 * time.Millisecond):
	}
	close(syncer.release)
}

func TestPushHandlerTickRespondsAfterTheMatchSyncEnds(t *testing.T) {
	syncer := &fakeSyncer{ran: make(chan struct{}, 1), release: make(chan struct{})}
	h := NewPushHandler(&fakePushStore{}, fakeBolaos{}, fakeMatches{}, nil, syncer, "", testCronSecret)
	done := make(chan int, 1)
	go func() {
		w := do(t, pushRouter(h), http.MethodPost, "/api/internal/notifications/tick", "", map[string]string{"X-Cron-Secret": testCronSecret})
		done <- w.Code
	}()
	<-syncer.ran
	select {
	case <-done:
		t.Fatal("the tick responded before the match sync ended")
	case <-time.After(50 * time.Millisecond):
	}
	close(syncer.release)
	select {
	case code := <-done:
		if code != http.StatusOK {
			t.Fatalf("status = %d, want 200", code)
		}
	case <-time.After(time.Second):
		t.Fatal("the tick did not respond after the match sync ended")
	}
}

func TestPushHandlerTickStopsWaitingForASlowMatchSync(t *testing.T) {
	syncer := &fakeSyncer{ran: make(chan struct{}, 1), release: make(chan struct{})}
	defer close(syncer.release)
	h := NewPushHandler(&fakePushStore{}, fakeBolaos{}, fakeMatches{}, nil, syncer, "", testCronSecret)
	h.syncWait = 20 * time.Millisecond
	done := make(chan int, 1)
	go func() {
		w := do(t, pushRouter(h), http.MethodPost, "/api/internal/notifications/tick", "", map[string]string{"X-Cron-Secret": testCronSecret})
		done <- w.Code
	}()
	select {
	case code := <-done:
		if code != http.StatusOK {
			t.Fatalf("status = %d, want 200", code)
		}
	case <-time.After(time.Second):
		t.Fatal("the tick waited past its limit for the match sync")
	}
}
