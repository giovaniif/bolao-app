package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"sort"
	"strconv"
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
	ListExpoTokensForBolao(ctx context.Context, bolaoID uuid.UUID) ([]models.ExpoPushToken, error)
	DeleteByEndpoint(ctx context.Context, endpoint string) error
	DeleteExpoToken(ctx context.Context, token string) error
	ClaimNotification(ctx context.Context, bolaoID uuid.UUID, round int, kind string, closesAt time.Time) (bool, error)
	ClaimUserNotification(ctx context.Context, userID, scopeID uuid.UUID, round int, kind string, closesAt time.Time) (bool, error)
}

type PushSender interface {
	Send(ctx context.Context, sub models.PushSubscription, payload []byte) (int, error)
}

type ExpoSender interface {
	Send(ctx context.Context, msgs []models.ExpoMessage) ([]models.ExpoResult, error)
}

type Audience struct {
	BolaoID uuid.UUID
	ScopeID uuid.UUID
}

func AudienceOf(b models.Bolao) Audience {
	scope := b.ID
	if b.CompetitionID != nil {
		scope = *b.CompetitionID
	}
	return Audience{BolaoID: b.ID, ScopeID: scope}
}

type NotificationService struct {
	store PushStore
	web   PushSender
	expo  ExpoSender
}

func NewNotificationService(store PushStore, web PushSender, expo ExpoSender) *NotificationService {
	return &NotificationService{store: store, web: web, expo: expo}
}

func (s *NotificationService) Notify(ctx context.Context, a Audience, r Reminder) (int, error) {
	claimed, err := s.store.ClaimNotification(ctx, a.BolaoID, r.Round, string(r.Kind), claimDeadline(r))
	if err != nil || !claimed {
		return 0, err
	}
	var subs []models.PushSubscription
	if s.web != nil {
		if subs, err = s.store.ListForBolao(ctx, a.BolaoID); err != nil {
			return 0, err
		}
	}
	var tokens []models.ExpoPushToken
	if s.expo != nil {
		if tokens, err = s.store.ListExpoTokensForBolao(ctx, a.BolaoID); err != nil {
			return 0, err
		}
	}
	users := make([]uuid.UUID, 0, len(subs)+len(tokens))
	for _, sub := range subs {
		users = append(users, sub.UserID)
	}
	for _, t := range tokens {
		users = append(users, t.UserID)
	}
	due, err := s.claimUsers(ctx, a, r, users)
	if err != nil {
		return 0, err
	}

	payload := BuildPushPayload(r)
	sent, err := s.sendWeb(ctx, r, payload, subs, due)
	if err != nil {
		return sent, err
	}
	n, err := s.sendExpo(ctx, r, payload, tokens, due)
	return sent + n, err
}

func (s *NotificationService) claimUsers(ctx context.Context, a Audience, r Reminder, users []uuid.UUID) (map[uuid.UUID]bool, error) {
	due := map[uuid.UUID]bool{}
	seen := map[uuid.UUID]bool{}
	for _, u := range users {
		if seen[u] {
			continue
		}
		seen[u] = true
		ok, err := s.store.ClaimUserNotification(ctx, u, a.ScopeID, r.Round, string(r.Kind), claimDeadline(r))
		if err != nil {
			return nil, err
		}
		due[u] = ok
	}
	return due, nil
}

func (s *NotificationService) sendWeb(ctx context.Context, r Reminder, p PushPayload, subs []models.PushSubscription, due map[uuid.UUID]bool) (int, error) {
	payload, err := json.Marshal(p)
	if err != nil {
		return 0, err
	}
	sent := 0
	for _, sub := range subs {
		if !due[sub.UserID] {
			continue
		}
		status, err := s.web.Send(ctx, sub, payload)
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

func (s *NotificationService) sendExpo(ctx context.Context, r Reminder, p PushPayload, tokens []models.ExpoPushToken, due map[uuid.UUID]bool) (int, error) {
	var msgs []models.ExpoMessage
	for _, t := range tokens {
		if due[t.UserID] {
			msgs = append(msgs, ExpoMessageFor(t.Token, r, p))
		}
	}
	if len(msgs) == 0 {
		return 0, nil
	}
	results, err := s.expo.Send(ctx, msgs)
	if err != nil {
		log.Printf("expo push %s round %d: %v", r.Kind, r.Round, err)
	}
	sent := 0
	for _, res := range results {
		switch {
		case res.DeviceNotRegistered:
			if err := s.store.DeleteExpoToken(ctx, res.Token); err != nil {
				return sent, err
			}
		case res.OK:
			sent++
		}
	}
	return sent, nil
}

func ExpoMessageFor(token string, r Reminder, p PushPayload) models.ExpoMessage {
	return models.ExpoMessage{
		To:       token,
		Title:    p.Title,
		Body:     p.Body,
		Data:     map[string]string{"url": p.URL, "round": strconv.Itoa(r.Round)},
		Sound:    "default",
		Priority: "high",
	}
}

func endpointHost(endpoint string) string {
	if u, err := url.Parse(endpoint); err == nil && u.Host != "" {
		return u.Host
	}
	return "unknown push service"
}

func claimDeadline(r Reminder) time.Time {
	if r.Kind == ReminderNewRound {
		return time.Unix(0, 0).UTC()
	}
	return r.ClosesAt
}

func (s *NotificationService) Tick(ctx context.Context, a Audience, rounds []RoundClose, now time.Time) (int, error) {
	total := 0
	for _, r := range DueReminders(rounds, now) {
		n, err := s.Notify(ctx, a, r)
		total += n
		if err != nil {
			return total, err
		}
	}
	return total, nil
}
