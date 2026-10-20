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
	for _, name := range []string{"001_init.sql", "002_timestamptz.sql", "003_match_partials.sql", "004_passwords.sql", "005_partials_nullable.sql", "006_boloes.sql", "007_push_notifications.sql", "008_competitions.sql", "009_match_sync.sql", "010_bolao_members.sql", "011_many_active_boloes.sql", "012_hidden_boloes.sql"} {
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
