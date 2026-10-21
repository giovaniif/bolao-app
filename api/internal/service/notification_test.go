package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

var closeTime = time.Date(2026, 10, 18, 19, 0, 0, 0, time.UTC)

func closingAt(round int, at time.Time) models.Match {
	return models.Match{Round: round, MarketClosesAt: &at}
}

func TestRoundCloses(t *testing.T) {
	later := closeTime.Add(2 * time.Hour)
	got := RoundCloses([]models.Match{
		closingAt(2, later),
		closingAt(1, later),
		closingAt(1, closeTime),
		{Round: 3},
	})
	want := []RoundClose{{Round: 1, ClosesAt: closeTime}, {Round: 2, ClosesAt: later}}
	if len(got) != len(want) {
		t.Fatalf("rounds = %+v, want %+v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("round %d: got %+v, want %+v", i, got[i], want[i])
		}
	}
}

func TestDueReminders(t *testing.T) {
	rounds := []RoundClose{{Round: 7, ClosesAt: closeTime}}
	tests := []struct {
		name string
		now  time.Time
		want []ReminderKind
	}{
		{"more than a day ahead, nothing is due", closeTime.Add(-25 * time.Hour), nil},
		{"exactly a day ahead, day-before is due", closeTime.Add(-24 * time.Hour), []ReminderKind{ReminderDayBefore}},
		{"a late tick within the grace hour still sends day-before", closeTime.Add(-23*time.Hour - time.Minute), []ReminderKind{ReminderDayBefore}},
		{"past the grace hour, day-before is skipped", closeTime.Add(-23 * time.Hour), nil},
		{"eleven minutes ahead, nothing is due", closeTime.Add(-11 * time.Minute), nil},
		{"exactly ten minutes ahead, ten-minutes is due", closeTime.Add(-10 * time.Minute), []ReminderKind{ReminderTenMinutes}},
		{"a late tick inside the last ten minutes still sends it", closeTime.Add(-time.Minute), []ReminderKind{ReminderTenMinutes}},
		{"at the close, nothing is sent", closeTime, nil},
		{"after the close, nothing is sent", closeTime.Add(time.Hour), nil},
	}
	for _, tt := range tests {
		got := DueReminders(rounds, tt.now)
		if len(got) != len(tt.want) {
			t.Errorf("%s: got %+v, want kinds %v", tt.name, got, tt.want)
			continue
		}
		for i, k := range tt.want {
			if got[i].Kind != k || got[i].Round != 7 || !got[i].ClosesAt.Equal(closeTime) {
				t.Errorf("%s: got %+v, want kind %s", tt.name, got[i], k)
			}
		}
	}
}

func TestBuildPushPayload(t *testing.T) {
	tests := []struct {
		kind      ReminderKind
		wantTitle string
		wantBody  string
	}{
		{ReminderNewRound, "Rodada 7 aberta", "dom 18/10 às 16:00"},
		{ReminderDayBefore, "Falta 1 dia para a rodada 7 fechar", "dom 18/10 às 16:00"},
		{ReminderTenMinutes, "Rodada 7 fecha em 10 minutos", "Última chance"},
	}
	for _, tt := range tests {
		p := BuildPushPayload(Reminder{Kind: tt.kind, Round: 7, ClosesAt: closeTime})
		if p.Title != tt.wantTitle {
			t.Errorf("%s: title = %q, want %q", tt.kind, p.Title, tt.wantTitle)
		}
		if !strings.Contains(p.Body, tt.wantBody) {
			t.Errorf("%s: body = %q, want it to contain %q", tt.kind, p.Body, tt.wantBody)
		}
		if p.URL != "/palpites?rodada=7" {
			t.Errorf("%s: url = %q", tt.kind, p.URL)
		}
	}
}

type fakeStore struct {
	subs          []models.PushSubscription
	tokens        []models.ExpoPushToken
	claimed       map[string]bool
	deleted       []string
	deletedTokens []string
	listErr       error
}

func (f *fakeStore) ListForBolao(context.Context, uuid.UUID) ([]models.PushSubscription, error) {
	return f.subs, f.listErr
}

func (f *fakeStore) ListExpoTokensForBolao(context.Context, uuid.UUID) ([]models.ExpoPushToken, error) {
	return f.tokens, nil
}

func (f *fakeStore) DeleteByEndpoint(_ context.Context, endpoint string) error {
	f.deleted = append(f.deleted, endpoint)
	return nil
}

func (f *fakeStore) DeleteExpoToken(_ context.Context, token string) error {
	f.deletedTokens = append(f.deletedTokens, token)
	return nil
}

func (f *fakeStore) claim(key string) bool {
	if f.claimed[key] {
		return false
	}
	f.claimed[key] = true
	return true
}

func (f *fakeStore) ClaimNotification(_ context.Context, bolaoID uuid.UUID, round int, kind string, closesAt time.Time) (bool, error) {
	return f.claim(fmt.Sprintf("bolao %s %d %s %s", bolaoID, round, kind, closesAt)), nil
}

func (f *fakeStore) ClaimUserNotification(_ context.Context, userID, scopeID uuid.UUID, round int, kind string, closesAt time.Time) (bool, error) {
	return f.claim(fmt.Sprintf("user %s %s %d %s %s", userID, scopeID, round, kind, closesAt)), nil
}

type fakeExpo struct {
	sent     []models.ExpoMessage
	rejected map[string]bool
	err      error
}

func (f *fakeExpo) Send(_ context.Context, msgs []models.ExpoMessage) ([]models.ExpoResult, error) {
	if f.err != nil {
		return nil, f.err
	}
	results := make([]models.ExpoResult, len(msgs))
	for i, m := range msgs {
		f.sent = append(f.sent, m)
		results[i] = models.ExpoResult{Token: m.To, OK: !f.rejected[m.To], DeviceNotRegistered: f.rejected[m.To]}
	}
	return results, nil
}

func TestNotificationServiceSendsTheReminderToExpoDevicesToo(t *testing.T) {
	user := uuid.New()
	store := &fakeStore{
		claimed: map[string]bool{},
		subs:    []models.PushSubscription{{UserID: user, Endpoint: "ok"}},
		tokens:  []models.ExpoPushToken{{UserID: user, Token: "ExponentPushToken[a]"}, {UserID: uuid.New(), Token: "ExponentPushToken[gone]"}},
	}
	expo := &fakeExpo{rejected: map[string]bool{"ExponentPushToken[gone]": true}}
	svc := NewNotificationService(store, &fakeSender{status: map[string]int{"ok": 201}}, expo)

	sent, err := svc.Notify(context.Background(), Audience{BolaoID: uuid.New()}, Reminder{Kind: ReminderTenMinutes, Round: 7, ClosesAt: closeTime})
	if err != nil {
		t.Fatalf("Notify: %v", err)
	}
	if sent != 2 {
		t.Errorf("sent = %d, want 2: one web and one Expo delivery", sent)
	}
	if len(expo.sent) != 2 {
		t.Fatalf("expo messages = %d, want 2", len(expo.sent))
	}
	m := expo.sent[0]
	if m.To != "ExponentPushToken[a]" || m.Title != "Rodada 7 fecha em 10 minutos" || m.Data["url"] != "/palpites?rodada=7" || m.Data["round"] != "7" {
		t.Errorf("expo message = %+v, want the same reminder as Web Push", m)
	}
	if strings.Join(store.deletedTokens, ",") != "ExponentPushToken[gone]" {
		t.Errorf("deleted tokens = %v, want the DeviceNotRegistered token", store.deletedTokens)
	}
}

func TestNotificationServiceRemindsAUserOncePerDeadlineAcrossBoloesOfOneCompetition(t *testing.T) {
	user := uuid.New()
	competition := uuid.New()
	store := &fakeStore{
		claimed: map[string]bool{},
		subs:    []models.PushSubscription{{UserID: user, Endpoint: "ok"}},
		tokens:  []models.ExpoPushToken{{UserID: user, Token: "ExponentPushToken[a]"}},
	}
	web := &fakeSender{status: map[string]int{"ok": 201}}
	expo := &fakeExpo{}
	svc := NewNotificationService(store, web, expo)
	r := Reminder{Kind: ReminderDayBefore, Round: 7, ClosesAt: closeTime}

	for _, a := range []Audience{{BolaoID: uuid.New(), ScopeID: competition}, {BolaoID: uuid.New(), ScopeID: competition}} {
		if _, err := svc.Notify(context.Background(), a, r); err != nil {
			t.Fatalf("Notify: %v", err)
		}
	}
	if len(web.payloads) != 1 || len(expo.sent) != 1 {
		t.Errorf("web = %d, expo = %d deliveries; want 1 each for two bolões on one competition", len(web.payloads), len(expo.sent))
	}

	if _, err := svc.Notify(context.Background(), Audience{BolaoID: uuid.New(), ScopeID: uuid.New()}, r); err != nil {
		t.Fatalf("Notify: %v", err)
	}
	if len(web.payloads) != 2 || len(expo.sent) != 2 {
		t.Errorf("web = %d, expo = %d deliveries; want a bolão on another competition to remind again", len(web.payloads), len(expo.sent))
	}
}

func TestNotificationServiceSendsToExpoWithoutWebPush(t *testing.T) {
	store := &fakeStore{claimed: map[string]bool{}, tokens: []models.ExpoPushToken{{UserID: uuid.New(), Token: "ExponentPushToken[a]"}}, listErr: errors.New("web push is off")}
	expo := &fakeExpo{}
	svc := NewNotificationService(store, nil, expo)

	sent, err := svc.Notify(context.Background(), Audience{BolaoID: uuid.New()}, Reminder{Kind: ReminderNewRound, Round: 3, ClosesAt: closeTime})
	if err != nil || sent != 1 {
		t.Errorf("sent = %d, err = %v; want one Expo delivery and no Web Push lookup", sent, err)
	}
}

func TestNotificationServiceKeepsWebPushWhenExpoFails(t *testing.T) {
	user := uuid.New()
	store := &fakeStore{
		claimed: map[string]bool{},
		subs:    []models.PushSubscription{{UserID: user, Endpoint: "ok"}},
		tokens:  []models.ExpoPushToken{{UserID: user, Token: "ExponentPushToken[a]"}},
	}
	svc := NewNotificationService(store, &fakeSender{status: map[string]int{"ok": 201}}, &fakeExpo{err: errors.New("expo down")})

	sent, err := svc.Notify(context.Background(), Audience{BolaoID: uuid.New()}, Reminder{Kind: ReminderNewRound, Round: 3, ClosesAt: closeTime})
	if err != nil || sent != 1 {
		t.Errorf("sent = %d, err = %v; want the web delivery to count", sent, err)
	}
}

func TestAudienceOfScopesRemindersByCompetition(t *testing.T) {
	competition := uuid.New()
	shared := models.Bolao{ID: uuid.New(), CompetitionID: &competition}
	own := models.Bolao{ID: uuid.New()}
	if got := AudienceOf(shared); got.BolaoID != shared.ID || got.ScopeID != competition {
		t.Errorf("bolão on a competition: got %+v, want scope %s", got, competition)
	}
	if got := AudienceOf(own); got.BolaoID != own.ID || got.ScopeID != own.ID {
		t.Errorf("bolão without a competition: got %+v, want its own id as scope", got)
	}
}

type fakeSender struct {
	status   map[string]int
	payloads [][]byte
}

func (f *fakeSender) Send(_ context.Context, sub models.PushSubscription, payload []byte) (int, error) {
	f.payloads = append(f.payloads, payload)
	status := f.status[sub.Endpoint]
	if status >= 500 {
		return status, errors.New("push service down")
	}
	return status, nil
}

func TestNotificationServiceNotify(t *testing.T) {
	store := &fakeStore{
		claimed: map[string]bool{},
		subs: []models.PushSubscription{
			{Endpoint: "ok"}, {Endpoint: "gone"}, {Endpoint: "unknown"}, {Endpoint: "down"},
		},
	}
	sender := &fakeSender{status: map[string]int{"ok": 201, "gone": http.StatusGone, "unknown": http.StatusNotFound, "down": 503}}
	svc := NewNotificationService(store, sender, nil)
	r := Reminder{Kind: ReminderNewRound, Round: 7, ClosesAt: closeTime}

	sent, err := svc.Notify(context.Background(), Audience{BolaoID: uuid.New()}, r)
	if err != nil {
		t.Fatalf("Notify: %v", err)
	}
	if sent != 1 {
		t.Errorf("sent = %d, want 1", sent)
	}
	if strings.Join(store.deleted, ",") != "gone,unknown" {
		t.Errorf("deleted = %v, want expired subscriptions gone and unknown", store.deleted)
	}
	var p PushPayload
	if err := json.Unmarshal(sender.payloads[0], &p); err != nil || p.Title != "Rodada 7 aberta" {
		t.Errorf("payload = %s (%v)", sender.payloads[0], err)
	}

	r.ClosesAt = r.ClosesAt.Add(time.Hour)
	sent, err = svc.Notify(context.Background(), Audience{BolaoID: uuid.New()}, r)
	if err != nil || sent != 0 || len(sender.payloads) != 4 {
		t.Errorf("announcing again after the deadline moved: sent = %d, err = %v, deliveries = %d; want nothing resent", sent, err, len(sender.payloads))
	}
}

func TestNotificationServiceNotifyListError(t *testing.T) {
	store := &fakeStore{claimed: map[string]bool{}, listErr: errors.New("db down")}
	svc := NewNotificationService(store, &fakeSender{}, nil)
	if _, err := svc.Notify(context.Background(), Audience{BolaoID: uuid.New()}, Reminder{Kind: ReminderNewRound, Round: 1, ClosesAt: closeTime}); err == nil {
		t.Error("want the list error to surface")
	}
}

func TestNotificationServiceTick(t *testing.T) {
	store := &fakeStore{claimed: map[string]bool{}, subs: []models.PushSubscription{{Endpoint: "ok"}}}
	sender := &fakeSender{status: map[string]int{"ok": 201}}
	svc := NewNotificationService(store, sender, nil)
	rounds := []RoundClose{{Round: 7, ClosesAt: closeTime}, {Round: 8, ClosesAt: closeTime.Add(48 * time.Hour)}}

	for _, now := range []time.Time{closeTime.Add(-5 * time.Minute), closeTime.Add(-4 * time.Minute)} {
		if _, err := svc.Tick(context.Background(), Audience{BolaoID: uuid.New()}, rounds, now); err != nil {
			t.Fatalf("Tick: %v", err)
		}
	}
	if len(sender.payloads) != 1 {
		t.Errorf("deliveries = %d, want 1: only round 7 is due and only once", len(sender.payloads))
	}
}

func TestNotificationServiceRemindersRearmWhenDeadlineMoves(t *testing.T) {
	store := &fakeStore{claimed: map[string]bool{}, subs: []models.PushSubscription{{Endpoint: "ok"}}}
	sender := &fakeSender{status: map[string]int{"ok": 201}}
	svc := NewNotificationService(store, sender, nil)
	bolao := Audience{BolaoID: uuid.New()}

	for _, at := range []time.Time{closeTime, closeTime, closeTime.Add(time.Hour)} {
		if _, err := svc.Notify(context.Background(), bolao, Reminder{Kind: ReminderTenMinutes, Round: 7, ClosesAt: at}); err != nil {
			t.Fatalf("Notify: %v", err)
		}
	}
	if len(sender.payloads) != 2 {
		t.Errorf("deliveries = %d, want 2: once per distinct deadline", len(sender.payloads))
	}
}

func TestNotificationServiceAnnouncesARoundOnceEvenWhenItsDeadlineMoves(t *testing.T) {
	store := &fakeStore{claimed: map[string]bool{}, subs: []models.PushSubscription{{Endpoint: "ok"}}}
	sender := &fakeSender{status: map[string]int{"ok": 201}}
	svc := NewNotificationService(store, sender, nil)
	bolao := Audience{BolaoID: uuid.New()}

	for _, at := range []time.Time{closeTime, closeTime.Add(time.Hour)} {
		if _, err := svc.Notify(context.Background(), bolao, Reminder{Kind: ReminderNewRound, Round: 7, ClosesAt: at}); err != nil {
			t.Fatalf("Notify: %v", err)
		}
	}
	if len(sender.payloads) != 1 {
		t.Errorf("deliveries = %d, want 1: an admin fixing the close time must not re-announce the round", len(sender.payloads))
	}
}

func TestEndpointHostNamesThePushServiceInLogs(t *testing.T) {
	tests := []struct {
		endpoint string
		want     string
	}{
		{"https://fcm.googleapis.com/fcm/send/abc", "fcm.googleapis.com"},
		{"https://web.push.apple.com/QK3W", "web.push.apple.com"},
		{"no-host-here", "unknown push service"},
		{"://broken", "unknown push service"},
	}
	for _, tt := range tests {
		if got := endpointHost(tt.endpoint); got != tt.want {
			t.Errorf("endpointHost(%q) = %q, want %q", tt.endpoint, got, tt.want)
		}
	}
}
