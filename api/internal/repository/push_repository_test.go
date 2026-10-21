package repository

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func pushTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	if testing.Short() {
		t.Skip("requires a database")
	}
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		url = "postgres://postgres:postgres@localhost:5432/bolao_test?sslmode=disable"
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil || pool.Ping(ctx) != nil {
		t.Skipf("database not available: %v", err)
	}
	for _, name := range []string{"001_init.sql", "002_timestamptz.sql", "003_match_partials.sql", "004_passwords.sql", "005_partials_nullable.sql", "006_boloes.sql", "007_push_notifications.sql", "008_competitions.sql", "009_match_sync.sql", "010_bolao_members.sql", "011_many_active_boloes.sql", "012_hidden_boloes.sql", "013_bolao_first_round.sql", "014_password_reset.sql", "015_expo_push_tokens.sql"} {
		sql, err := os.ReadFile(filepath.Join("..", "..", "migrations", name))
		if err != nil {
			t.Fatalf("read %s: %v", name, err)
		}
		if _, err := pool.Exec(ctx, string(sql)); err != nil {
			t.Fatalf("migrate %s: %v", name, err)
		}
	}
	t.Cleanup(pool.Close)
	return pool
}

func newParticipant(t *testing.T, pool *pgxpool.Pool, bolaoID uuid.UUID) uuid.UUID {
	t.Helper()
	ctx := context.Background()
	user := &models.User{ID: uuid.New(), Username: "push_" + uuid.NewString()[:8], DisplayName: "Push"}
	if err := NewUserRepository(pool).Create(ctx, user); err != nil {
		t.Fatalf("create user: %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO bolao_participants (bolao_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, bolaoID, user.ID); err != nil {
		t.Fatalf("add participant: %v", err)
	}
	return user.ID
}

func TestPushRepository_SubscriptionsLifecycle(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	repo := NewPushRepository(pool)
	bolao, err := NewBolaoRepository(pool).GetActive(ctx)
	if err != nil {
		t.Fatalf("GetActive: %v", err)
	}
	alice := newParticipant(t, pool, bolao.ID)
	bob := newParticipant(t, pool, bolao.ID)
	endpoint := "https://push.example/" + uuid.NewString()

	sub := &models.PushSubscription{UserID: alice, Endpoint: endpoint, P256dh: "k", Auth: "a"}
	if err := repo.Upsert(ctx, sub); err != nil {
		t.Fatalf("Upsert: %v", err)
	}
	if err := repo.Upsert(ctx, &models.PushSubscription{UserID: bob, Endpoint: endpoint, P256dh: "k2", Auth: "a2"}); err != nil {
		t.Fatalf("re-Upsert: %v", err)
	}

	owner := func() (uuid.UUID, int) {
		subs, err := repo.ListForBolao(ctx, bolao.ID)
		if err != nil {
			t.Fatalf("ListForBolao: %v", err)
		}
		var found uuid.UUID
		n := 0
		for _, s := range subs {
			if s.Endpoint == endpoint {
				found = s.UserID
				n++
			}
		}
		return found, n
	}
	if got, n := owner(); got != bob || n != 1 {
		t.Errorf("endpoint owner = %v (x%d), want bob once", got, n)
	}

	if err := repo.DeleteForUser(ctx, alice, endpoint); err != nil {
		t.Fatalf("DeleteForUser: %v", err)
	}
	if _, n := owner(); n != 1 {
		t.Errorf("deleting as another user removed the subscription")
	}
	if err := repo.DeleteByEndpoint(ctx, endpoint); err != nil {
		t.Fatalf("DeleteByEndpoint: %v", err)
	}
	if _, n := owner(); n != 0 {
		t.Errorf("subscription still listed after DeleteByEndpoint")
	}
}

func TestPushRepository_ClaimNotificationOnce(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	repo := NewPushRepository(pool)
	bolao, err := NewBolaoRepository(pool).GetActive(ctx)
	if err != nil {
		t.Fatalf("GetActive: %v", err)
	}
	round := 1000 + int(time.Now().UnixNano()%100000)
	closes := time.Now().Truncate(time.Second)

	tests := []struct {
		name     string
		kind     string
		closesAt time.Time
		want     bool
	}{
		{"first claim wins", "day_before", closes, true},
		{"repeat claim loses", "day_before", closes, false},
		{"another kind is independent", "ten_minutes", closes, true},
		{"a moved deadline re-arms the reminder", "day_before", closes.Add(time.Hour), true},
	}
	for _, tt := range tests {
		got, err := repo.ClaimNotification(ctx, bolao.ID, round, tt.kind, tt.closesAt)
		if err != nil {
			t.Fatalf("%s: %v", tt.name, err)
		}
		if got != tt.want {
			t.Errorf("%s: claimed = %v, want %v", tt.name, got, tt.want)
		}
	}
}

func TestPushRepository_ExpoTokensLifecycle(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	repo := NewPushRepository(pool)
	bolao, err := NewBolaoRepository(pool).GetActive(ctx)
	if err != nil {
		t.Fatalf("GetActive: %v", err)
	}
	alice := newParticipant(t, pool, bolao.ID)
	bob := newParticipant(t, pool, bolao.ID)
	token := "ExponentPushToken[" + uuid.NewString() + "]"

	if err := repo.UpsertExpoToken(ctx, &models.ExpoPushToken{UserID: alice, Token: token, Platform: "ios"}); err != nil {
		t.Fatalf("UpsertExpoToken: %v", err)
	}
	if err := repo.UpsertExpoToken(ctx, &models.ExpoPushToken{UserID: bob, Token: token, Platform: "android"}); err != nil {
		t.Fatalf("re-UpsertExpoToken: %v", err)
	}

	owner := func() (models.ExpoPushToken, int) {
		tokens, err := repo.ListExpoTokensForBolao(ctx, bolao.ID)
		if err != nil {
			t.Fatalf("ListExpoTokensForBolao: %v", err)
		}
		var found models.ExpoPushToken
		n := 0
		for _, tk := range tokens {
			if tk.Token == token {
				found = tk
				n++
			}
		}
		return found, n
	}
	if got, n := owner(); got.UserID != bob || got.Platform != "android" || n != 1 {
		t.Errorf("token owner = %+v (x%d), want bob on android once", got, n)
	}

	if err := repo.DeleteExpoTokenForUser(ctx, alice, token); err != nil {
		t.Fatalf("DeleteExpoTokenForUser: %v", err)
	}
	if _, n := owner(); n != 1 {
		t.Errorf("deleting as another user removed the token")
	}
	if err := repo.DeleteExpoToken(ctx, token); err != nil {
		t.Fatalf("DeleteExpoToken: %v", err)
	}
	if _, n := owner(); n != 0 {
		t.Errorf("token still listed after DeleteExpoToken")
	}
}

func TestPushRepository_ClaimUserNotificationOnce(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	repo := NewPushRepository(pool)
	bolao, err := NewBolaoRepository(pool).GetActive(ctx)
	if err != nil {
		t.Fatalf("GetActive: %v", err)
	}
	user := newParticipant(t, pool, bolao.ID)
	scope := uuid.New()
	closes := time.Now().Truncate(time.Second)

	tests := []struct {
		name     string
		scope    uuid.UUID
		closesAt time.Time
		want     bool
	}{
		{"first claim wins", scope, closes, true},
		{"the same deadline from another bolão of the competition loses", scope, closes, false},
		{"another competition is independent", uuid.New(), closes, true},
		{"a moved deadline re-arms the reminder", scope, closes.Add(time.Hour), true},
	}
	for _, tt := range tests {
		got, err := repo.ClaimUserNotification(ctx, user, tt.scope, 7, "day_before", tt.closesAt)
		if err != nil {
			t.Fatalf("%s: %v", tt.name, err)
		}
		if got != tt.want {
			t.Errorf("%s: claimed = %v, want %v", tt.name, got, tt.want)
		}
	}
}

func TestBolaoRepository_ListActiveSkipsFinishedBoloes(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	repo := NewBolaoRepository(pool)
	owner := &models.User{ID: uuid.New(), Username: "push_" + uuid.NewString()[:8], DisplayName: "Push"}
	if err := NewUserRepository(pool).Create(ctx, owner); err != nil {
		t.Fatalf("create user: %v", err)
	}
	open, err := repo.CreateOwned(ctx, "push open "+uuid.NewString()[:8], owner.ID)
	if err != nil {
		t.Fatalf("CreateOwned: %v", err)
	}
	done, err := repo.CreateOwned(ctx, "push done "+uuid.NewString()[:8], owner.ID)
	if err != nil {
		t.Fatalf("CreateOwned: %v", err)
	}
	if err := repo.Finish(ctx, done.ID); err != nil {
		t.Fatalf("Finish: %v", err)
	}

	active, err := repo.ListActive(ctx)
	if err != nil {
		t.Fatalf("ListActive: %v", err)
	}
	listed := map[uuid.UUID]bool{}
	for _, b := range active {
		listed[b.ID] = true
		if b.Status != "active" {
			t.Errorf("listed bolão %s with status %s", b.ID, b.Status)
		}
	}
	if !listed[open.ID] || listed[done.ID] {
		t.Errorf("open listed = %v, finished listed = %v; want only the open bolão", listed[open.ID], listed[done.ID])
	}
}
