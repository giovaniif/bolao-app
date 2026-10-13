package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"sort"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

type ReminderKind string

const (
	ReminderNewRound   ReminderKind = "new_round"
	ReminderDayBefore  ReminderKind = "day_before"
	ReminderTenMinutes ReminderKind = "ten_minutes"
)

const (
	dayBeforeLead  = 24 * time.Hour
	tenMinutesLead = 10 * time.Minute
	// A day-before reminder arriving later than this is no longer "a day before"; it would
	// only duplicate the new-round notice for rounds created close to their deadline.
	dayBeforeGrace = time.Hour
)

type RoundClose struct {
	Round    int
	ClosesAt time.Time
}

type Reminder struct {
	Kind     ReminderKind
	Round    int
	ClosesAt time.Time
}

// RoundCloses returns each round's deadline: the earliest market close among its matches.
// Rounds without any close time are omitted, since there is nothing to remind about.
func RoundCloses(matches []models.Match) []RoundClose {
	earliest := map[int]time.Time{}
	for _, m := range matches {
		if m.MarketClosesAt == nil {
			continue
		}
		if cur, ok := earliest[m.Round]; !ok || m.MarketClosesAt.Before(cur) {
			earliest[m.Round] = *m.MarketClosesAt
		}
	}
	closes := make([]RoundClose, 0, len(earliest))
	for round, at := range earliest {
		closes = append(closes, RoundClose{Round: round, ClosesAt: at})
	}
	sort.Slice(closes, func(i, j int) bool { return closes[i].Round < closes[j].Round })
	return closes
}

// DueReminders returns the reminders whose window contains now. Delivery is deduplicated
// by the caller, so a reminder stays due for its whole window and survives missed ticks.
func DueReminders(rounds []RoundClose, now time.Time) []Reminder {
	var due []Reminder
	for _, r := range rounds {
		untilClose := r.ClosesAt.Sub(now)
		switch {
		case untilClose <= 0:
		case untilClose <= tenMinutesLead:
			due = append(due, Reminder{Kind: ReminderTenMinutes, Round: r.Round, ClosesAt: r.ClosesAt})
		case untilClose <= dayBeforeLead && untilClose > dayBeforeLead-dayBeforeGrace:
			due = append(due, Reminder{Kind: ReminderDayBefore, Round: r.Round, ClosesAt: r.ClosesAt})
		}
	}
	return due
}

type PushPayload struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	URL   string `json:"url"`
	Tag   string `json:"tag"`
}

var weekdaysPT = [...]string{"dom", "seg", "ter", "qua", "qui", "sex", "sáb"}

func formatCloseTime(t time.Time) string {
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err == nil {
		t = t.In(loc)
	}
	return fmt.Sprintf("%s %s às %s", weekdaysPT[t.Weekday()], t.Format("02/01"), t.Format("15:04"))
}

func BuildPushPayload(r Reminder) PushPayload {
	p := PushPayload{
		URL: fmt.Sprintf("/palpites?rodada=%d", r.Round),
		Tag: fmt.Sprintf("rodada-%d", r.Round),
	}
	closes := formatCloseTime(r.ClosesAt)
	switch r.Kind {
	case ReminderNewRound:
		p.Title = fmt.Sprintf("Rodada %d aberta", r.Round)
		p.Body = fmt.Sprintf("Palpites até %s. Bora palpitar!", closes)
	case ReminderDayBefore:
		p.Title = fmt.Sprintf("Falta 1 dia para a rodada %d fechar", r.Round)
		p.Body = fmt.Sprintf("O mercado fecha %s. Confira seus palpites.", closes)
	case ReminderTenMinutes:
		p.Title = fmt.Sprintf("Rodada %d fecha em 10 minutos", r.Round)
		p.Body = "Última chance de ajustar seus palpites!"
	}
	return p
}

type PushStore interface {
	ListForBolao(ctx context.Context, bolaoID uuid.UUID) ([]models.PushSubscription, error)
	DeleteByEndpoint(ctx context.Context, endpoint string) error
	ClaimNotification(ctx context.Context, bolaoID uuid.UUID, round int, kind string, closesAt time.Time) (bool, error)
}

// PushSender delivers one payload and returns the push service's HTTP status.
type PushSender interface {
	Send(ctx context.Context, sub models.PushSubscription, payload []byte) (int, error)
}

type NotificationService struct {
	store  PushStore
	sender PushSender
}

func NewNotificationService(store PushStore, sender PushSender) *NotificationService {
	return &NotificationService{store: store, sender: sender}
}

// Notify sends the reminder to every subscribed participant, at most once per
// (bolão, round, kind, deadline). It returns how many deliveries succeeded.
func (s *NotificationService) Notify(ctx context.Context, bolaoID uuid.UUID, r Reminder) (int, error) {
	claimed, err := s.store.ClaimNotification(ctx, bolaoID, r.Round, string(r.Kind), r.ClosesAt)
	if err != nil || !claimed {
		return 0, err
	}
	subs, err := s.store.ListForBolao(ctx, bolaoID)
	if err != nil {
		return 0, err
	}
	payload, err := json.Marshal(BuildPushPayload(r))
	if err != nil {
		return 0, err
	}

	sent := 0
	for _, sub := range subs {
		status, err := s.sender.Send(ctx, sub, payload)
		switch {
		case status == http.StatusNotFound || status == http.StatusGone:
			if err := s.store.DeleteByEndpoint(ctx, sub.Endpoint); err != nil {
				return sent, err
			}
		case err == nil && status >= 200 && status < 300:
			sent++
		default:
			log.Printf("push %s round %d to %s: status %d, err %v", r.Kind, r.Round, endpointHost(sub.Endpoint), status, err)
		}
	}
	return sent, nil
}

func endpointHost(endpoint string) string {
	if u, err := url.Parse(endpoint); err == nil && u.Host != "" {
		return u.Host
	}
	return "unknown push service"
}

// Tick sends every reminder due at now for the given rounds.
func (s *NotificationService) Tick(ctx context.Context, bolaoID uuid.UUID, rounds []RoundClose, now time.Time) (int, error) {
	total := 0
	for _, r := range DueReminders(rounds, now) {
		n, err := s.Notify(ctx, bolaoID, r)
		total += n
		if err != nil {
			return total, err
		}
	}
	return total, nil
}
