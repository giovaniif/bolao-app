package syncdevdb

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"
)

const clientImage = "postgres:17"

func repoRoot(t *testing.T) string {
	t.Helper()
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	return root
}

func script(t *testing.T) string {
	return filepath.Join(repoRoot(t), "tools", "sync-dev-db", "sync.sh")
}

func TestSyncRefusesToRunWithoutDatabaseURLs(t *testing.T) {
	cmd := exec.Command("bash", script(t))
	cmd.Env = []string{"PATH=" + os.Getenv("PATH")}
	out, err := cmd.CombinedOutput()
	if err == nil {
		t.Fatalf("sync.sh passed without database URLs\n%s", out)
	}
	if !strings.Contains(string(out), "PROD_DATABASE_URL") || !strings.Contains(string(out), "DEV_DATABASE_URL") {
		t.Fatalf("output does not name the missing variables\n%s", out)
	}
}

func TestSyncRefusesTheSameDatabaseForProdAndDev(t *testing.T) {
	cmd := exec.Command("bash", script(t))
	cmd.Env = []string{
		"PATH=" + os.Getenv("PATH"),
		"PROD_DATABASE_URL=postgres://u:p@h:5432/db",
		"DEV_DATABASE_URL=postgres://u:p@h:5432/db",
	}
	out, err := cmd.CombinedOutput()
	if err == nil || !strings.Contains(string(out), "same database") {
		t.Fatalf("sync.sh did not refuse the same URL for prod and dev\n%s", out)
	}
	if strings.Contains(string(out), "u:p@h") {
		t.Fatalf("sync.sh printed a database URL\n%s", out)
	}
}

func migrations(t *testing.T) []string {
	t.Helper()
	src, err := os.ReadFile(filepath.Join(repoRoot(t), "api", "cmd", "server", "main.go"))
	if err != nil {
		t.Fatal(err)
	}
	names := regexp.MustCompile(`"(\d{3}_[a-z_]+\.sql)"`).FindAllStringSubmatch(string(src), -1)
	var out []string
	for _, n := range names {
		out = append(out, n[1])
	}
	if len(out) < 17 {
		t.Fatalf("found %d migrations in main.go", len(out))
	}
	return out
}

type database struct {
	t   *testing.T
	url string
}

func docker(t *testing.T, args ...string) string {
	t.Helper()
	out, err := exec.Command("docker", args...).CombinedOutput()
	if err != nil {
		t.Fatalf("docker %s: %v\n%s", strings.Join(args, " "), err, out)
	}
	return strings.TrimSpace(string(out))
}

func startPostgres(t *testing.T) *database {
	t.Helper()
	id := docker(t, "run", "-d", "--rm", "-e", "POSTGRES_PASSWORD=pw", "-p", "127.0.0.1::5432", "postgres:16")
	t.Cleanup(func() { _ = exec.Command("docker", "rm", "-f", id).Run() })
	port := ""
	for i := 0; i < 30 && port == ""; i++ {
		out, err := exec.Command("docker", "port", id, "5432/tcp").Output()
		if err == nil {
			first := strings.SplitN(strings.TrimSpace(string(out)), "\n", 2)[0]
			port = first[strings.LastIndex(first, ":")+1:]
		} else {
			time.Sleep(500 * time.Millisecond)
		}
	}
	if port == "" {
		t.Fatal("postgres container has no published port")
	}
	db := &database{t: t, url: fmt.Sprintf("postgres://postgres:pw@127.0.0.1:%s/postgres?sslmode=disable", port)}
	for i := 0; i < 60; i++ {
		if _, err := db.try("SELECT 1"); err == nil {
			return db
		}
		time.Sleep(time.Second)
	}
	t.Fatal("postgres did not start")
	return nil
}

func (d *database) try(sql string) (string, error) {
	cmd := exec.Command("docker", "run", "--rm", "-i", "--network", "host", "-e", "DB", clientImage,
		"sh", "-c", `psql "$DB" -X -q -t -A -v ON_ERROR_STOP=1`)
	cmd.Env = append(os.Environ(), "DB="+d.url)
	cmd.Stdin = strings.NewReader(sql)
	out, err := cmd.CombinedOutput()
	return strings.TrimSpace(string(out)), err
}

func (d *database) exec(sql string) string {
	d.t.Helper()
	out, err := d.try(sql)
	if err != nil {
		d.t.Fatalf("psql: %v\n%s\n%s", err, sql, out)
	}
	return out
}

func (d *database) migrate(names []string) {
	d.t.Helper()
	for _, name := range names {
		sql, err := os.ReadFile(filepath.Join(repoRoot(d.t), "api", "migrations", name))
		if err != nil {
			d.t.Fatal(err)
		}
		if out, err := d.try(string(sql)); err != nil {
			d.t.Fatalf("migration %s: %v\n%s", name, err, out)
		}
	}
}

func hasColumn(d *database, table, column string) bool {
	return d.exec(fmt.Sprintf(`SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '%s' AND column_name = '%s'`, table, column)) == "1"
}

func hasTable(d *database, table string) bool {
	return d.exec(fmt.Sprintf(`SELECT to_regclass('public.%s') IS NOT NULL`, table)) == "t"
}

func seedProd(d *database) {
	d.exec(`
INSERT INTO users (username, display_name, password_hash, email) VALUES
  ('giovani', 'Giovani', 'hash-g', 'owner@example.com'),
  ('ana', 'Ana', 'hash-a', 'ana@example.com'),
  ('bia', 'Bia', 'hash-b', 'bia@example.com');
INSERT INTO matches (bolao_id, round, home_team, away_team) SELECT id, 1, 'Flamengo', 'Palmeiras' FROM boloes ORDER BY created_at LIMIT 1;
INSERT INTO predictions (user_id, match_id, home_goals, away_goals)
  SELECT u.id, m.id, 2, 1 FROM users u, matches m;
INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
  SELECT id, 'https://push.example/' || username, 'k', 'a' FROM users;
INSERT INTO user_identities (provider, subject, user_id)
  SELECT 'google', username, id FROM users;
`)
	if hasTable(d, "expo_push_tokens") {
		d.exec(`INSERT INTO expo_push_tokens (user_id, token, platform) SELECT id, 'ExponentPushToken[' || username || ']', 'ios' FROM users;`)
	}
	if hasTable(d, "password_reset_tokens") {
		d.exec(`INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) SELECT md5(username), id, now() + interval '1 hour' FROM users;`)
	}
	if hasColumn(d, "user_identities", "email") {
		d.exec(`UPDATE user_identities SET email = subject || '@example.com';`)
	}
}

func seedDev(d *database) {
	d.exec(`
CREATE TABLE IF NOT EXISTS dev_only_feature (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
INSERT INTO users (username, display_name, password_hash) VALUES ('devuser', 'Dev', 'hash-d');
INSERT INTO dev_only_feature (user_id) SELECT id FROM users;
`)
}

func runSync(t *testing.T, prod, dev *database) {
	t.Helper()
	cmd := exec.Command("bash", script(t))
	cmd.Env = append(os.Environ(), "PROD_DATABASE_URL="+prod.url, "DEV_DATABASE_URL="+dev.url, "PG_CLIENT_IMAGE="+clientImage)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("sync.sh: %v\n%s", err, out)
	}
	if strings.Contains(string(out), "pw@") {
		t.Fatalf("sync.sh printed a database URL\n%s", out)
	}
}

func TestSyncCopiesProdIntoDevAndScrubsIt(t *testing.T) {
	if os.Getenv("SYNC_DEV_DB_TEST") == "" {
		t.Skip("set SYNC_DEV_DB_TEST=1 to run against docker postgres containers")
	}
	all := migrations(t)
	cases := map[string][]string{
		"prod at the same migration as dev": all,
		"prod behind dev":                   all[:13],
	}
	for name, prodMigrations := range cases {
		t.Run(name, func(t *testing.T) {
			prod, dev := startPostgres(t), startPostgres(t)
			prod.migrate(prodMigrations)
			seedProd(prod)
			dev.migrate(all)
			seedDev(dev)

			runSync(t, prod, dev)

			if got := dev.exec(`SELECT string_agg(username || '=' || coalesce(email, '-') || '=' || password_hash, ',' ORDER BY username) FROM users`); got != "ana=-=hash-a,bia=-=hash-b,giovani=owner@example.com=hash-g" {
				t.Fatalf("users after sync: %s", got)
			}
			if got := dev.exec(`SELECT count(*) FROM predictions`); got != "3" {
				t.Fatalf("predictions after sync: %s, want 3", got)
			}
			if hasTable(dev, "dev_only_feature") {
				t.Fatal("a dev-only table survived the sync")
			}
			for _, table := range []string{"push_subscriptions", "expo_push_tokens", "password_reset_tokens", "user_identities", "user_notification_log"} {
				if hasTable(dev, table) {
					if got := dev.exec("SELECT count(*) FROM " + table); got != "0" {
						t.Fatalf("%s has %s rows after the scrub", table, got)
					}
				}
			}
			if got := dev.exec(`SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity`); got != "0" {
				t.Fatalf("%s public tables have no row level security after sync", got)
			}

			dev.migrate(all)
			dev.migrate(all)
			for _, table := range []string{"expo_push_tokens", "password_reset_tokens", "user_notification_log"} {
				if !hasTable(dev, table) {
					t.Fatalf("migrations did not bring %s forward on dev", table)
				}
			}
			if !hasColumn(dev, "user_identities", "email") {
				t.Fatal("migrations did not bring user_identities.email forward on dev")
			}

			runSync(t, prod, dev)
		})
	}
}
