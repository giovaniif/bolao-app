package handler

import (
	"context"
	"crypto/subtle"
	"log"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/bolao-app/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type pushSubscriptionStore interface {
	Upsert(ctx context.Context, s *models.PushSubscription) error
	DeleteForUser(ctx context.Context, userID uuid.UUID, endpoint string) error
}

type activeBolaoGetter interface {
	GetActive(ctx context.Context) (*models.Bolao, error)
}

type bolaoMatchLister interface {
	ListAllByBolao(ctx context.Context, bolaoID uuid.UUID) ([]models.Match, error)
}

type RoundNotifier interface {
	Notify(ctx context.Context, bolaoID uuid.UUID, r service.Reminder) (int, error)
	Tick(ctx context.Context, bolaoID uuid.UUID, rounds []service.RoundClose, now time.Time) (int, error)
}

type MatchSyncer interface {
	RunOnce(ctx context.Context) (service.SyncReport, error)
}

const (
	announceTimeout  = 30 * time.Second
	matchSyncTimeout = 2 * time.Minute
)

type PushHandler struct {
	store      pushSubscriptionStore
	bolaos     activeBolaoGetter
	matches    bolaoMatchLister
	notifier   RoundNotifier
	publicKey  string
	syncer     MatchSyncer
	syncing    atomic.Bool
	cronSecret string
	now        func() time.Time
}

func NewPushHandler(store pushSubscriptionStore, bolaos activeBolaoGetter, matches bolaoMatchLister, notifier RoundNotifier, syncer MatchSyncer, publicKey, cronSecret string) *PushHandler {
	return &PushHandler{
		syncer:     syncer,
		store:      store,
		bolaos:     bolaos,
		matches:    matches,
		notifier:   notifier,
		publicKey:  publicKey,
		cronSecret: cronSecret,
		now:        time.Now,
	}
}

func (h *PushHandler) enabled() bool {
	return h.notifier != nil && h.publicKey != ""
}

func (h *PushHandler) PublicKey(c *gin.Context) {
	if !h.enabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "notificações indisponíveis"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"public_key": h.publicKey})
}

type subscriptionRequest struct {
	Endpoint string `json:"endpoint" binding:"required,url"`
	Keys     struct {
		P256dh string `json:"p256dh" binding:"required"`
		Auth   string `json:"auth" binding:"required"`
	} `json:"keys" binding:"required"`
}

func (h *PushHandler) Subscribe(c *gin.Context) {
	if !h.enabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "notificações indisponíveis"})
		return
	}
	var req subscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "inscrição inválida"})
		return
	}
	sub := &models.PushSubscription{
		UserID:   c.MustGet("user_id").(uuid.UUID),
		Endpoint: req.Endpoint,
		P256dh:   req.Keys.P256dh,
		Auth:     req.Keys.Auth,
	}
	if err := h.store.Upsert(c.Request.Context(), sub); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

type unsubscribeRequest struct {
	Endpoint string `json:"endpoint" binding:"required"`
}

func (h *PushHandler) Unsubscribe(c *gin.Context) {
	var req unsubscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "inscrição inválida"})
		return
	}
	if err := h.store.DeleteForUser(c.Request.Context(), c.MustGet("user_id").(uuid.UUID), req.Endpoint); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *PushHandler) Tick(c *gin.Context) {
	given := c.GetHeader("X-Cron-Secret")
	if h.cronSecret == "" || subtle.ConstantTimeCompare([]byte(given), []byte(h.cronSecret)) != 1 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "não autorizado"})
		return
	}
	h.startMatchSync()
	if !h.enabled() {
		c.JSON(http.StatusOK, gin.H{"sent": 0})
		return
	}
	ctx := c.Request.Context()
	active, err := h.bolaos.GetActive(ctx)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"sent": 0})
		return
	}
	matches, err := h.matches.ListAllByBolao(ctx, active.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	sent, err := h.notifier.Tick(ctx, active.ID, service.RoundCloses(matches), h.now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error(), "sent": sent})
		return
	}
	c.JSON(http.StatusOK, gin.H{"sent": sent})
}

func (h *PushHandler) AnnounceRound(bolaoID uuid.UUID, round int, closesAt *time.Time) {
	if !h.enabled() || closesAt == nil || !closesAt.After(h.now()) {
		return
	}
	go h.announce(bolaoID, service.Reminder{Kind: service.ReminderNewRound, Round: round, ClosesAt: *closesAt})
}

func (h *PushHandler) announce(bolaoID uuid.UUID, r service.Reminder) {
	ctx, cancel := context.WithTimeout(context.Background(), announceTimeout)
	defer cancel()
	if _, err := h.notifier.Notify(ctx, bolaoID, r); err != nil {
		log.Printf("announce round %d: %v", r.Round, err)
	}
}

func (h *PushHandler) startMatchSync() {
	if h.syncer == nil || !h.syncing.CompareAndSwap(false, true) {
		return
	}
	go func() {
		defer h.syncing.Store(false)
		ctx, cancel := context.WithTimeout(context.Background(), matchSyncTimeout)
		defer cancel()
		if report, err := h.syncer.RunOnce(ctx); err != nil {
			log.Printf("match sync: %+v: %v", report, err)
		}
	}()
}
