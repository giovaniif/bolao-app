package repository

import (
	"context"
	"testing"
)

var allMigrations = append(append([]string{}, migrationsBeforeMembers...), "010_bolao_members.sql", "011_many_active_boloes.sql", "012_hidden_boloes.sql", "013_bolao_first_round.sql", "014_password_reset.sql", "015_expo_push_tokens.sql", "016_user_identities.sql", "017_row_level_security.sql")

func TestRowLevelSecurityMigration_EnablesRLSOnEveryPublicTableAndStaysIdempotent(t *testing.T) {
	pool := freshDatabase(t)
	ctx := context.Background()
	runMigrationFiles(t, pool, allMigrations...)
	runMigrationFiles(t, pool, allMigrations...)

	rows, err := pool.Query(ctx, `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND (NOT c.relrowsecurity OR c.relforcerowsecurity)`)
	if err != nil {
		t.Fatalf("query: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatalf("scan: %v", err)
		}
		t.Errorf("table %s: RLS off or forced", name)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("rows: %v", err)
	}
}

func TestRowLevelSecurityMigration_OwnerRoleStillReadsAndWrites(t *testing.T) {
	pool := freshDatabase(t)
	ctx := context.Background()
	runMigrationFiles(t, pool, allMigrations...)

	if _, err := pool.Exec(ctx, `INSERT INTO boloes (name) VALUES ('Depois do RLS')`); err != nil {
		t.Fatalf("insert: %v", err)
	}
	var n int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM boloes WHERE name = 'Depois do RLS'`).Scan(&n); err != nil {
		t.Fatalf("select: %v", err)
	}
	if n != 1 {
		t.Errorf("rows = %d, want 1", n)
	}
}

func TestRowLevelSecurityMigration_RevokesTableAccessFromSupabaseRoles(t *testing.T) {
	pool := freshDatabase(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `DO $$ BEGIN
		IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
		IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
	END $$`); err != nil {
		t.Fatalf("roles: %v", err)
	}
	runMigrationFiles(t, pool, allMigrations[:len(allMigrations)-1]...)
	if _, err := pool.Exec(ctx, `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated`); err != nil {
		t.Fatalf("grant: %v", err)
	}
	runMigrationFiles(t, pool, "017_row_level_security.sql")

	var granted bool
	if err := pool.QueryRow(ctx, `SELECT has_table_privilege('anon', 'public.users', 'SELECT') OR has_table_privilege('authenticated', 'public.users', 'SELECT')`).Scan(&granted); err != nil {
		t.Fatalf("privilege: %v", err)
	}
	if granted {
		t.Error("anon or authenticated can still select users")
	}
}
