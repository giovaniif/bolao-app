package repository

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

var migrationsBeforeMembers = []string{"001_init.sql", "002_timestamptz.sql", "003_match_partials.sql", "004_passwords.sql", "005_partials_nullable.sql", "006_boloes.sql", "007_push_notifications.sql", "008_competitions.sql", "009_match_sync.sql"}

func freshDatabase(t *testing.T) *pgxpool.Pool {
	t.Helper()
	admin := pushTestPool(t)
	ctx := context.Background()
	name := "bolao_fresh_" + strings.ReplaceAll(uuid.NewString()[:8], "-", "")
	if _, err := admin.Exec(ctx, "CREATE DATABASE "+name); err != nil {
		t.Fatalf("create database: %v", err)
	}
	cfg := admin.Config().ConnConfig.Copy()
	url := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable", cfg.User, cfg.Password, cfg.Host, cfg.Port, name)
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(func() {
		pool.Close()
		_, _ = admin.Exec(context.Background(), "DROP DATABASE IF EXISTS "+name)
	})
	return pool
}

func runMigrationFiles(t *testing.T, pool *pgxpool.Pool, names ...string) {
	t.Helper()
	for _, name := range names {
		sql, err := os.ReadFile(filepath.Join("..", "..", "migrations", name))
		if err != nil {
			t.Fatalf("read %s: %v", name, err)
		}
		if _, err := pool.Exec(context.Background(), string(sql)); err != nil {
			t.Fatalf("migrate %s: %v", name, err)
		}
	}
}

type seededUser struct {
	id      uuid.UUID
	isAdmin bool
	paid    float64
}

func TestBolaoMembersMigration_KeepsEveryCurrentParticipant(t *testing.T) {
	pool := freshDatabase(t)
	ctx := context.Background()
	runMigrationFiles(t, pool, migrationsBeforeMembers...)

	var bolaoID uuid.UUID
	if err := pool.QueryRow(ctx, `SELECT id FROM boloes WHERE status = 'active'`).Scan(&bolaoID); err != nil {
		t.Fatalf("bolão: %v", err)
	}
	users := []seededUser{
		{uuid.New(), true, 70},
		{uuid.New(), true, 50},
		{uuid.New(), false, 50},
		{uuid.New(), false, 0},
	}
	for i, u := range users {
		if _, err := pool.Exec(ctx, `INSERT INTO users (id, username, display_name, is_admin, password_hash, created_at)
			VALUES ($1, $2, $2, $3, 'x', TIMESTAMP '2026-01-01' + make_interval(days => $4))`, u.id, fmt.Sprintf("user%d", i), u.isAdmin, i); err != nil {
			t.Fatalf("user: %v", err)
		}
		if _, err := pool.Exec(ctx, `INSERT INTO bolao_participants (bolao_id, user_id, amount_paid) VALUES ($1, $2, $3)`, bolaoID, u.id, u.paid); err != nil {
			t.Fatalf("participant: %v", err)
		}
	}

	runMigrationFiles(t, pool, "010_bolao_members.sql", "010_bolao_members.sql")

	var ownerID uuid.UUID
	var inviteCode string
	if err := pool.QueryRow(ctx, `SELECT owner_id, invite_code FROM boloes WHERE id = $1`, bolaoID).Scan(&ownerID, &inviteCode); err != nil {
		t.Fatalf("bolão after: %v", err)
	}
	if ownerID != users[0].id {
		t.Errorf("owner = %v, want the oldest admin %v", ownerID, users[0].id)
	}
	if len(inviteCode) < 6 {
		t.Errorf("invite code = %q, want one of at least 6 characters", inviteCode)
	}

	wantRoles := []string{"owner", "admin", "participant", "participant"}
	for i, u := range users {
		var role, status string
		var paid float64
		if err := pool.QueryRow(ctx, `SELECT role, status, amount_paid FROM bolao_participants WHERE bolao_id = $1 AND user_id = $2`, bolaoID, u.id).Scan(&role, &status, &paid); err != nil {
			t.Fatalf("participant %d after: %v", i, err)
		}
		if role != wantRoles[i] || status != "active" || paid != u.paid {
			t.Errorf("participant %d = %s %s %.2f, want %s active %.2f", i, role, status, paid, wantRoles[i], u.paid)
		}
	}
}

func TestBolaoMembersMigration_ABolaoWithoutAdminsKeepsNoOwner(t *testing.T) {
	pool := freshDatabase(t)
	ctx := context.Background()
	runMigrationFiles(t, pool, migrationsBeforeMembers...)
	runMigrationFiles(t, pool, "010_bolao_members.sql")

	var owners int
	if err := pool.QueryRow(ctx, `SELECT COUNT(owner_id) FROM boloes`).Scan(&owners); err != nil {
		t.Fatalf("count: %v", err)
	}
	if owners != 0 {
		t.Errorf("owners = %d, want 0", owners)
	}
}

func TestBolaoMembersMigration_UsersCanSignUpWithoutAPasswordAndWithAnEmail(t *testing.T) {
	pool := freshDatabase(t)
	ctx := context.Background()
	runMigrationFiles(t, pool, migrationsBeforeMembers...)
	runMigrationFiles(t, pool, "010_bolao_members.sql")

	if _, err := pool.Exec(ctx, `INSERT INTO users (username, display_name, email) VALUES ('social', 'Social', 'A@Example.com')`); err != nil {
		t.Fatalf("user without password: %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO users (username, display_name, email) VALUES ('other', 'Other', 'a@example.COM')`); err == nil {
		t.Error("a second user with the same email in other case was accepted")
	}
}
