package service

import (
	"context"
	"errors"
	"testing"
	"time"
)

type stubPrimary struct {
	matches []FeedMatch
	err     error
	calls   int
}

func (s *stubPrimary) FeedMatches(context.Context, string, int) ([]FeedMatch, error) {
	s.calls++
	return s.matches, s.err
}

type stubBackup struct {
	results map[string][]FeedResult
	err     error
	days    []string
}

func (s *stubBackup) ResultsOn(_ context.Context, code string, day time.Time) ([]FeedResult, error) {
	key := code + " " + day.Format(time.DateOnly)
	s.days = append(s.days, key)
	return s.results[key], s.err
}

var fallbackNow = time.Date(2026, 10, 19, 3, 0, 0, 0, time.UTC)

func timedMatch(id int64, kickoff time.Time, home, away string) FeedMatch {
	return FeedMatch{ProviderID: id, Kickoff: kickoff, Status: FeedStatusTimed, Matchday: 31, HomeTeam: home, AwayTeam: away}
}

func newFallback(primary *stubPrimary, backup *stubBackup) *FallbackFeed {
	return NewFallbackFeed(primary, backup, func() time.Time { return fallbackNow })
}

func TestFallbackFeedReturnsThePrimaryListWhenThePrimaryWorks(t *testing.T) {
	kickoff := time.Date(2026, 10, 18, 21, 30, 0, 0, time.UTC)
	primary := &stubPrimary{matches: []FeedMatch{timedMatch(1, kickoff, "Bahia", "Flamengo")}}
	backup := &stubBackup{}
	got, err := newFallback(primary, backup).FeedMatches(context.Background(), "BSA", 2026)
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if len(got) != 1 || got[0].ProviderID != 1 {
		t.Errorf("got = %+v, want the primary list", got)
	}
	if len(backup.days) != 0 {
		t.Errorf("backup calls = %v, want none", backup.days)
	}
}

func TestFallbackFeedFailsWhenThePrimaryFailsBeforeAnyGoodList(t *testing.T) {
	primaryErr := errors.New("status 503")
	_, err := newFallback(&stubPrimary{err: primaryErr}, &stubBackup{}).FeedMatches(context.Background(), "BSA", 2026)
	if !errors.Is(err, primaryErr) {
		t.Errorf("err = %v, want %v", err, primaryErr)
	}
}

func TestFallbackFeedCopiesBackupResultsOntoKnownMatches(t *testing.T) {
	kickoff := time.Date(2026, 10, 18, 21, 30, 0, 0, time.UTC)
	primary := &stubPrimary{matches: []FeedMatch{
		timedMatch(1, kickoff, "Bahia", "Flamengo"),
		timedMatch(2, kickoff, "Atlético-MG", "Vasco"),
		timedMatch(3, kickoff, "São Paulo", "Grêmio"),
		timedMatch(4, kickoff.Add(-72*time.Hour), "Santos", "Remo"),
	}}
	backup := &stubBackup{results: map[string][]FeedResult{
		"BSA 2026-10-18": {
			{Kickoff: kickoff, Status: FeedStatusFinished, HomeTeam: "Bahia", AwayTeam: "Flamengo", HomeGoals: goals(0), AwayGoals: goals(3)},
			{Kickoff: kickoff, Status: FeedStatusInPlay, HomeTeam: "Atletico Mineiro", AwayTeam: "Vasco da Gama", HomeGoals: goals(1), AwayGoals: goals(1)},
		},
	}}
	feed := newFallback(primary, backup)
	if _, err := feed.FeedMatches(context.Background(), "BSA", 2026); err != nil {
		t.Fatalf("first call err = %v", err)
	}
	primary.err = errors.New("status 429")

	got, err := feed.FeedMatches(context.Background(), "BSA", 2026)
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if len(got) != 4 {
		t.Fatalf("len = %d, want 4", len(got))
	}
	if got[0].Status != FeedStatusFinished || *got[0].HomeGoals != 0 || *got[0].AwayGoals != 3 {
		t.Errorf("match 1 = %+v, want FINISHED 0x3", got[0])
	}
	if got[1].Status != FeedStatusInPlay || *got[1].HomeGoals != 1 {
		t.Errorf("match 2 = %+v, want IN_PLAY 1x1 by alias", got[1])
	}
	if got[2].Status != FeedStatusTimed || got[2].HomeGoals != nil {
		t.Errorf("match 3 = %+v, want unchanged", got[2])
	}
	if got[0].ProviderID != 1 || got[0].Matchday != 31 {
		t.Errorf("match 1 = %+v, want the primary id and round kept", got[0])
	}
	if len(backup.days) != 1 {
		t.Errorf("backup days = %v, want only the open day in the last 24 hours", backup.days)
	}
}

func TestFallbackFeedMatchesOnOneTeamWhenTheOtherNameDiffers(t *testing.T) {
	kickoff := time.Date(2026, 10, 18, 19, 0, 0, 0, time.UTC)
	primary := &stubPrimary{matches: []FeedMatch{timedMatch(1, kickoff, "Bragantino", "Palmeiras")}}
	backup := &stubBackup{results: map[string][]FeedResult{
		"BSA 2026-10-18": {{Kickoff: kickoff, Status: FeedStatusFinished, HomeTeam: "RB Bragantino SP", AwayTeam: "Palmeiras", HomeGoals: goals(2), AwayGoals: goals(1)}},
	}}
	feed := newFallback(primary, backup)
	_, _ = feed.FeedMatches(context.Background(), "BSA", 2026)
	primary.err = errors.New("timeout")
	got, err := feed.FeedMatches(context.Background(), "BSA", 2026)
	if err != nil || got[0].Status != FeedStatusFinished {
		t.Errorf("got = %+v, err = %v, want FINISHED", got, err)
	}
}

func TestFallbackFeedReturnsThePrimaryErrorWhenTheBackupFails(t *testing.T) {
	kickoff := time.Date(2026, 10, 18, 21, 30, 0, 0, time.UTC)
	primary := &stubPrimary{matches: []FeedMatch{timedMatch(1, kickoff, "Bahia", "Flamengo")}}
	feed := newFallback(primary, &stubBackup{err: errors.New("backup down")})
	_, _ = feed.FeedMatches(context.Background(), "BSA", 2026)
	primaryErr := errors.New("status 500")
	primary.err = primaryErr
	if _, err := feed.FeedMatches(context.Background(), "BSA", 2026); !errors.Is(err, primaryErr) {
		t.Errorf("err = %v, want %v", err, primaryErr)
	}
}

func TestFallbackFeedKeepsSeasonsApart(t *testing.T) {
	kickoff := time.Date(2026, 10, 18, 21, 30, 0, 0, time.UTC)
	primary := &stubPrimary{matches: []FeedMatch{timedMatch(1, kickoff, "Bahia", "Flamengo")}}
	feed := newFallback(primary, &stubBackup{})
	_, _ = feed.FeedMatches(context.Background(), "BSA", 2026)
	primary.err = errors.New("status 500")
	if _, err := feed.FeedMatches(context.Background(), "CL", 2026); err == nil {
		t.Error("err = nil, want the primary error for a competition with no good list")
	}
}

func TestSameTeam(t *testing.T) {
	cases := []struct {
		ours, theirs string
		want         bool
	}{
		{"Grêmio", "Gremio", true},
		{"Vasco", "Vasco da Gama", true},
		{"Atlético-MG", "Atletico Mineiro", true},
		{"Athletico-PR", "Athletico Paranaense", true},
		{"Bayern", "Bayern Munich", true},
		{"Flamengo", "Fluminense", false},
		{"", "Bahia", false},
	}
	for _, c := range cases {
		if got := SameTeam(c.ours, c.theirs); got != c.want {
			t.Errorf("SameTeam(%q, %q) = %v, want %v", c.ours, c.theirs, got, c.want)
		}
	}
}
