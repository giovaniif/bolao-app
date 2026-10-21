package thesportsdb

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/bolao-app/api/internal/service"
)

func fixtureServer(t *testing.T, status int) *httptest.Server {
	t.Helper()
	body, err := os.ReadFile("testdata/bsa_2026-10-18.json")
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/json/secret/eventsday.php" || r.URL.Query().Get("d") != "2026-10-18" || r.URL.Query().Get("l") != "4351" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.WriteHeader(status)
		_, _ = w.Write(body)
	}))
	t.Cleanup(srv.Close)
	return srv
}

var day = time.Date(2026, 10, 18, 0, 0, 0, 0, time.UTC)

func TestResultsOnMapsEventsToFeedResults(t *testing.T) {
	srv := fixtureServer(t, http.StatusOK)
	got, err := NewClient(srv.URL, "secret").ResultsOn(context.Background(), "BSA", day)
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if len(got) != 5 {
		t.Fatalf("len = %d, want 5", len(got))
	}
	first := got[0]
	if first.HomeTeam != "Bahia" || first.AwayTeam != "Flamengo" || first.Status != service.FeedStatusFinished {
		t.Errorf("first = %+v, want Bahia x Flamengo FINISHED", first)
	}
	if first.HomeGoals == nil || *first.HomeGoals != 0 || first.AwayGoals == nil || *first.AwayGoals != 3 {
		t.Errorf("first goals = %v x %v, want 0 x 3", first.HomeGoals, first.AwayGoals)
	}
	if want := time.Date(2026, 10, 18, 21, 30, 0, 0, time.UTC); !first.Kickoff.Equal(want) {
		t.Errorf("kickoff = %v, want %v", first.Kickoff, want)
	}
	if got[2].HomeTeam != "Grêmio" {
		t.Errorf("third home = %q, want Grêmio", got[2].HomeTeam)
	}
	if got[3].Status != service.FeedStatusInPlay {
		t.Errorf("live status = %q, want IN_PLAY", got[3].Status)
	}
	if got[4].Status != "" || got[4].HomeGoals != nil {
		t.Errorf("not started = %+v, want no status and no goals", got[4])
	}
}

func TestResultsOnFailsOnAnUnknownCompetition(t *testing.T) {
	srv := fixtureServer(t, http.StatusOK)
	if _, err := NewClient(srv.URL, "secret").ResultsOn(context.Background(), "PL", day); err == nil {
		t.Error("err = nil, want an error for a competition without a league id")
	}
}

func TestResultsOnFailsOnAServerError(t *testing.T) {
	srv := fixtureServer(t, http.StatusBadGateway)
	if _, err := NewClient(srv.URL, "secret").ResultsOn(context.Background(), "BSA", day); err == nil {
		t.Error("err = nil, want an error on status 502")
	}
}

func TestResultsOnReturnsNothingForADayWithoutEvents(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"events":null}`))
	}))
	t.Cleanup(srv.Close)
	got, err := NewClient(srv.URL, "secret").ResultsOn(context.Background(), "CL", day)
	if err != nil || len(got) != 0 {
		t.Errorf("got = %v, err = %v, want no results", got, err)
	}
}
