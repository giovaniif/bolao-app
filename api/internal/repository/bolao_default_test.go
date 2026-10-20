package repository

import (
	"context"
	"testing"
)

func TestBolaoRepository_ABolaoCreatedByAUserNeverBecomesTheDefault(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	repo := NewBolaoRepository(pool)
	before, err := repo.GetActive(ctx)
	if err != nil {
		t.Fatalf("GetActive: %v", err)
	}
	owner := newUser(t, pool)

	created, err := repo.CreateOwned(ctx, "Bolão da firma", owner)
	if err != nil {
		t.Fatalf("CreateOwned: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(context.Background(), `DELETE FROM boloes WHERE id = $1`, created.ID) })

	after, err := repo.GetActive(ctx)
	if err != nil {
		t.Fatalf("GetActive after: %v", err)
	}
	if after.ID != before.ID {
		t.Errorf("default bolão = %s, want it to stay %s", after.Name, before.Name)
	}
	if created.Status != "active" || created.OwnerID == nil || *created.OwnerID != owner || created.InviteCode == "" {
		t.Errorf("created = %+v, want an active bolão owned by the user with an invite code", created)
	}
	m, err := NewMembershipRepository(pool).Get(ctx, created.ID, owner)
	if err != nil || m.Role != "owner" || m.Status != "active" {
		t.Errorf("owner membership = %+v, %v; want an active owner", m, err)
	}
}

func TestBolaoRepository_UpdateSettings(t *testing.T) {
	pool := pushTestPool(t)
	ctx := context.Background()
	repo := NewBolaoRepository(pool)
	created, err := repo.CreateOwned(ctx, "Antigo", newUser(t, pool))
	if err != nil {
		t.Fatalf("CreateOwned: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(context.Background(), `DELETE FROM boloes WHERE id = $1`, created.ID) })

	if err := repo.UpdateSettings(ctx, created.ID, "Novo", "public", false); err != nil {
		t.Fatalf("UpdateSettings: %v", err)
	}
	got, err := repo.GetByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.Name != "Novo" || got.Visibility != "public" || got.RequiresApproval {
		t.Errorf("bolão = %+v, want Novo, public, no approval", got)
	}
}

func TestMigrations_RunOnEveryBootWithManyActiveBoloes(t *testing.T) {
	pool := freshDatabase(t)
	ctx := context.Background()
	all := append(append([]string{}, migrationsBeforeMembers...), "010_bolao_members.sql", "011_many_active_boloes.sql")
	runMigrationFiles(t, pool, all...)
	if _, err := pool.Exec(ctx, `INSERT INTO boloes (name) VALUES ('Segundo ativo')`); err != nil {
		t.Fatalf("second active bolão: %v", err)
	}

	runMigrationFiles(t, pool, all...)
	runMigrationFiles(t, pool, all...)

	var unique bool
	if err := pool.QueryRow(ctx, `SELECT i.indisunique FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = 'idx_boloes_one_active'`).Scan(&unique); err != nil {
		t.Fatalf("index: %v", err)
	}
	if unique {
		t.Error("idx_boloes_one_active is unique again after a boot")
	}
}
