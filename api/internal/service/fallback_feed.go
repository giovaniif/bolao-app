package service

import (
	"context"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"
)

const minTeamNameMatch = 4

type FeedResult struct {
	Kickoff   time.Time
	Status    string
	HomeTeam  string
	AwayTeam  string
	HomeGoals *int
	AwayGoals *int
}

type ResultFeed interface {
	ResultsOn(ctx context.Context, code string, day time.Time) ([]FeedResult, error)
}

type FallbackFeed struct {
	primary MatchFeed
	backup  ResultFeed
	now     func() time.Time
	mu      sync.Mutex
	last    map[string][]FeedMatch
}

func NewFallbackFeed(primary MatchFeed, backup ResultFeed, now func() time.Time) *FallbackFeed {
	return &FallbackFeed{primary: primary, backup: backup, now: now, last: map[string][]FeedMatch{}}
}

func (f *FallbackFeed) FeedMatches(ctx context.Context, code string, season int) ([]FeedMatch, error) {
	key := code + "/" + strconv.Itoa(season)
	matches, err := f.primary.FeedMatches(ctx, code, season)
	f.mu.Lock()
	defer f.mu.Unlock()
	if err == nil {
		f.last[key] = matches
		return matches, nil
	}
	known, ok := f.last[key]
	if !ok {
		return nil, err
	}
	updated, backupErr := f.applyBackup(ctx, code, known)
	if backupErr != nil {
		return nil, err
	}
	f.last[key] = updated
	return updated, nil
}

func (f *FallbackFeed) applyBackup(ctx context.Context, code string, known []FeedMatch) ([]FeedMatch, error) {
	updated := append([]FeedMatch(nil), known...)
	results := map[string][]FeedResult{}
	now := f.now()
	for i, m := range updated {
		if m.Status == FeedStatusFinished || m.Kickoff.After(now) || m.Kickoff.Before(now.Add(-resultsSyncWindow)) {
			continue
		}
		day := m.Kickoff.UTC().Format(time.DateOnly)
		dayResults, fetched := results[day]
		if !fetched {
			start, _ := time.Parse(time.DateOnly, day)
			var err error
			dayResults, err = f.backup.ResultsOn(ctx, code, start)
			if err != nil {
				return nil, err
			}
			results[day] = dayResults
		}
		if r, ok := findResult(m, dayResults); ok {
			updated[i].Status = r.Status
			updated[i].HomeGoals = r.HomeGoals
			updated[i].AwayGoals = r.AwayGoals
		}
	}
	return updated, nil
}

func findResult(m FeedMatch, results []FeedResult) (FeedResult, bool) {
	for _, r := range results {
		if r.Status == "" || r.Kickoff.UTC().Format(time.DateOnly) != m.Kickoff.UTC().Format(time.DateOnly) {
			continue
		}
		if SameTeam(m.HomeTeam, r.HomeTeam) || SameTeam(m.AwayTeam, r.AwayTeam) {
			return r, true
		}
	}
	return FeedResult{}, false
}

var teamAliases = map[string]string{
	"atleticomg":  "atleticomineiro",
	"athleticopr": "athleticoparanaense",
}

var accents = strings.NewReplacer(
	"á", "a", "à", "a", "â", "a", "ã", "a", "ä", "a",
	"é", "e", "ê", "e", "è", "e", "ë", "e",
	"í", "i", "ì", "i", "ï", "i",
	"ó", "o", "ô", "o", "õ", "o", "ò", "o", "ö", "o",
	"ú", "u", "ù", "u", "ü", "u",
	"ç", "c", "ñ", "n",
)

func normalizeTeam(name string) string {
	folded := accents.Replace(strings.ToLower(name))
	var b strings.Builder
	for _, r := range folded {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	if alias, ok := teamAliases[b.String()]; ok {
		return alias
	}
	return b.String()
}

func SameTeam(ours, theirs string) bool {
	a, b := normalizeTeam(ours), normalizeTeam(theirs)
	if len(a) < minTeamNameMatch || len(b) < minTeamNameMatch {
		return false
	}
	return a == b || strings.Contains(a, b) || strings.Contains(b, a)
}
