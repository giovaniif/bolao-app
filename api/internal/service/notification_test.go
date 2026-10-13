package service

import (
	"context"
	"encoding/json"
	"errors"
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
	subs    []models.PushSubscription
	claimed map[string]bool
	deleted []string
	listErr error
}

func (f *fakeStore) ListForBolao(context.Context, uuid.UUID) ([]models.PushSubscription, error) {
	return f.subs, f.listErr
}

func (f *fakeStore) DeleteByEndpoint(_ context.Context, endpoint string) error {
	f.deleted = append(f.deleted, endpoint)
	return nil
}

func (f *fakeStore) ClaimNotification(_ context.Context, _ uuid.UUID, round int, kind string, closesAt time.Time) (bool, error) {
	key := kind + closesAt.String() + string(rune(round))
	if f.claimed[key] {
		return false, nil
	}
	f.claimed[key] = true
	return true, nil
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
	svc := NewNotificationService(store, sender)
	r := Reminder{Kind: ReminderNewRound, Round: 7, ClosesAt: closeTime}

	sent, err := svc.Notify(context.Background(), uuid.New(), r)
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

	sent, err = svc.Notify(context.Background(), uuid.New(), r)
	if err != nil || sent != 0 || len(sender.payloads) != 4 {
		t.Errorf("repeat notify: sent = %d, err = %v, deliveries = %d; want nothing resent", sent, err, len(sender.payloads))
	}
}

func TestNotificationServiceNotifyListError(t *testing.T) {
	store := &fakeStore{claimed: map[string]bool{}, listErr: errors.New("db down")}
	svc := NewNotificationService(store, &fakeSender{})
	if _, err := svc.Notify(context.Background(), uuid.New(), Reminder{Kind: ReminderNewRound, Round: 1, ClosesAt: closeTime}); err == nil {
		t.Error("want the list error to surface")
	}
}

func TestNotificationServiceTick(t *testing.T) {
	store := &fakeStore{claimed: map[string]bool{}, subs: []models.PushSubscription{{Endpoint: "ok"}}}
	sender := &fakeSender{status: map[string]int{"ok": 201}}
	svc := NewNotificationService(store, sender)
	rounds := []RoundClose{{Round: 7, ClosesAt: closeTime}, {Round: 8, ClosesAt: closeTime.Add(48 * time.Hour)}}

	for _, now := range []time.Time{closeTime.Add(-5 * time.Minute), closeTime.Add(-4 * time.Minute)} {
		if _, err := svc.Tick(context.Background(), uuid.New(), rounds, now); err != nil {
			t.Fatalf("Tick: %v", err)
		}
	}
	if len(sender.payloads) != 1 {
		t.Errorf("deliveries = %d, want 1: only round 7 is due and only once", len(sender.payloads))
	}
}
