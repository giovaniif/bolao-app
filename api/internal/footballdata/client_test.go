package footballdata

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"testing"
	"time"

	"github.com/bolao-app/api/internal/constants"
)

type fakeClock struct {
	now    time.Time
	sleeps []time.Duration
}

func (f *fakeClock) Now() time.Time { return f.now }

func (f *fakeClock) Sleep(_ context.Context, d time.Duration) error {
	f.sleeps = append(f.sleeps, d)
	f.now = f.now.Add(d)
	return nil
}

func fixtureServer(t *testing.T, file string, headers map[string]string, calls *int) *httptest.Server {
	t.Helper()
	body, err := os.ReadFile(file)
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		*calls++
		if r.Header.Get("X-Auth-Token") != "secret" {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		if r.URL.Path != "/v4/competitions/BSA/matches" || r.URL.Query().Get("season") != "2026" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		for k, v := range headers {
			w.Header().Set(k, v)
		}
		_, _ = w.Write(body)
	}))
	t.Cleanup(srv.Close)
	return srv
}

func newTestClient(srv *httptest.Server, clock *fakeClock) *Client {
	c := NewClient(srv.URL, "secret")
	c.now = clock.Now
	c.sleep = clock.Sleep
	return c
}

func TestMatches_ParsesTheBrasileiraoSeason(t *testing.T) {
	calls := 0
	srv := fixtureServer(t, "testdata/bsa_2026.json", nil, &calls)
	c := newTestClient(srv, &fakeClock{now: time.Now()})

	matches, err := c.Matches(context.Background(), "BSA", 2026)
	if err != nil {
		t.Fatalf("Matches: %v", err)
	}
	if len(matches) != 380 {
		t.Fatalf("matches = %d, want 380", len(matches))
	}
	i := slices.IndexFunc(matches, func(m Match) bool { return m.ID == 554740 })
	if i < 0 {
		t.Fatal("match 554740 not found")
	}
	m := matches[i]
	if m.HomeTeam != "Atlético-MG" || m.AwayTeam != "Palmeiras" || m.Matchday != 1 || m.Status != StatusFinished {
		t.Errorf("match = %+v, want Atlético-MG x Palmeiras, matchday 1, FINISHED", m)
	}
	if m.HomeGoals == nil || m.AwayGoals == nil || *m.HomeGoals != 2 || *m.AwayGoals != 2 {
		t.Errorf("score = %v x %v, want 2 x 2", m.HomeGoals, m.AwayGoals)
	}
	if !m.Kickoff.Equal(time.Date(2026, 1, 28, 22, 0, 0, 0, time.UTC)) {
		t.Errorf("kickoff = %v, want 2026-01-28T22:00Z", m.Kickoff)
	}
	if calls != 1 {
		t.Errorf("calls = %d, want 1", calls)
	}
}

func TestMatches_AnUnplayedMatchHasNoScore(t *testing.T) {
	calls := 0
	srv := fixtureServer(t, "testdata/bsa_2026.json", nil, &calls)
	matches, err := newTestClient(srv, &fakeClock{now: time.Now()}).Matches(context.Background(), "BSA", 2026)
	if err != nil {
		t.Fatalf("Matches: %v", err)
	}
	for _, m := range matches {
		if (m.Status == StatusScheduled || m.Status == StatusTimed) && (m.HomeGoals != nil || m.AwayGoals != nil) {
			t.Errorf("match %d status %s has a score %v x %v", m.ID, m.Status, m.HomeGoals, m.AwayGoals)
		}
	}
}

func TestMatches_EveryBrasileiraoTeamMapsToOurTeamList(t *testing.T) {
	calls := 0
	srv := fixtureServer(t, "testdata/bsa_2026.json", nil, &calls)
	matches, err := newTestClient(srv, &fakeClock{now: time.Now()}).Matches(context.Background(), "BSA", 2026)
	if err != nil {
		t.Fatalf("Matches: %v", err)
	}
	for _, m := range matches {
		for _, team := range []string{m.HomeTeam, m.AwayTeam} {
			if !slices.Contains(constants.Teams, team) {
				t.Errorf("team %q of match %d is not in constants.Teams", team, m.ID)
			}
		}
	}
}

func TestMatches_KeepsSixCallsAMinute(t *testing.T) {
	calls := 0
	srv := fixtureServer(t, "testdata/bsa_2026.json", nil, &calls)
	clock := &fakeClock{now: time.Now()}
	c := newTestClient(srv, clock)

	for range 2 {
		if _, err := c.Matches(context.Background(), "BSA", 2026); err != nil {
			t.Fatalf("Matches: %v", err)
		}
	}
	if len(clock.sleeps) != 1 || clock.sleeps[0] != 10*time.Second {
		t.Errorf("sleeps = %v, want [10s]", clock.sleeps)
	}
}

func TestMatches_WaitsForTheResetWhenTheMinuteQuotaIsSpent(t *testing.T) {
	calls := 0
	srv := fixtureServer(t, "testdata/bsa_2026.json", map[string]string{
		"x-requests-available-minute": "0",
		"X-RequestCounter-Reset":      "42",
	}, &calls)
	clock := &fakeClock{now: time.Now()}
	c := newTestClient(srv, clock)

	for range 2 {
		if _, err := c.Matches(context.Background(), "BSA", 2026); err != nil {
			t.Fatalf("Matches: %v", err)
		}
	}
	if len(clock.sleeps) != 1 || clock.sleeps[0] != 42*time.Second {
		t.Errorf("sleeps = %v, want [42s]", clock.sleeps)
	}
}

func TestMatches_TooManyRequestsReturnsRateLimitedWithTheReset(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("X-RequestCounter-Reset", "17")
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	t.Cleanup(srv.Close)
	clock := &fakeClock{now: time.Now()}
	c := newTestClient(srv, clock)

	_, err := c.Matches(context.Background(), "BSA", 2026)
	var limited *RateLimitedError
	if !errors.As(err, &limited) || limited.RetryAfter != 17*time.Second {
		t.Fatalf("err = %v, want RateLimitedError with RetryAfter 17s", err)
	}
	if _, err := c.Matches(context.Background(), "BSA", 2026); err == nil {
		t.Fatal("second call err = nil, want RateLimitedError")
	}
	if len(clock.sleeps) != 1 || clock.sleeps[0] != 17*time.Second {
		t.Errorf("sleeps = %v, want [17s] before the second call", clock.sleeps)
	}
}

func TestMatches_AnErrorStatusIsAnError(t *testing.T) {
	calls := 0
	srv := fixtureServer(t, "testdata/bsa_2026.json", nil, &calls)
	c := NewClient(srv.URL, "wrong")
	c.sleep = (&fakeClock{}).Sleep

	if _, err := c.Matches(context.Background(), "BSA", 2026); err == nil {
		t.Fatal("err = nil, want an error for 403")
	}
}
