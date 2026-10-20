package footballdata

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

const (
	DefaultBaseURL   = "https://api.football-data.org"
	minCallInterval  = 10 * time.Second
	headerAvailable  = "x-requests-available-minute"
	headerResetAfter = "X-RequestCounter-Reset"
)

const (
	StatusScheduled = "SCHEDULED"
	StatusTimed     = "TIMED"
	StatusInPlay    = "IN_PLAY"
	StatusPaused    = "PAUSED"
	StatusFinished  = "FINISHED"
	StatusPostponed = "POSTPONED"
	StatusSuspended = "SUSPENDED"
	StatusCancelled = "CANCELLED"
)

type Match struct {
	ID          int64
	Kickoff     time.Time
	Status      string
	Matchday    int
	Stage       string
	HomeTeam    string
	AwayTeam    string
	HomeGoals   *int
	AwayGoals   *int
	LastUpdated time.Time
}

type RateLimitedError struct {
	RetryAfter time.Duration
}

func (e *RateLimitedError) Error() string {
	return fmt.Sprintf("football-data.org rate limit, retry after %s", e.RetryAfter)
}

type Client struct {
	baseURL      string
	token        string
	http         *http.Client
	now          func() time.Time
	sleep        func(context.Context, time.Duration) error
	lastCall     time.Time
	blockedUntil time.Time
}

func NewClient(baseURL, token string) *Client {
	return &Client{
		baseURL: baseURL,
		token:   token,
		http:    &http.Client{Timeout: 30 * time.Second},
		now:     time.Now,
		sleep:   sleepContext,
	}
}

func sleepContext(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}

type apiTeam struct {
	Name      string `json:"name"`
	ShortName string `json:"shortName"`
}

type apiMatch struct {
	ID          int64     `json:"id"`
	UTCDate     time.Time `json:"utcDate"`
	Status      string    `json:"status"`
	Matchday    *int      `json:"matchday"`
	Stage       string    `json:"stage"`
	LastUpdated time.Time `json:"lastUpdated"`
	HomeTeam    apiTeam   `json:"homeTeam"`
	AwayTeam    apiTeam   `json:"awayTeam"`
	Score       struct {
		FullTime struct {
			Home *int `json:"home"`
			Away *int `json:"away"`
		} `json:"fullTime"`
	} `json:"score"`
}

func (c *Client) Matches(ctx context.Context, competitionCode string, season int) ([]Match, error) {
	if err := c.waitForSlot(ctx); err != nil {
		return nil, err
	}
	endpoint := fmt.Sprintf("%s/v4/competitions/%s/matches?season=%d", c.baseURL, url.PathEscape(competitionCode), season)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Auth-Token", c.token)

	c.lastCall = c.now()
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	c.readQuota(resp.Header)

	if resp.StatusCode == http.StatusTooManyRequests {
		retry := resetAfter(resp.Header)
		c.blockedUntil = c.now().Add(retry)
		return nil, &RateLimitedError{RetryAfter: retry}
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("football-data.org %s: status %d", competitionCode, resp.StatusCode)
	}

	var body struct {
		Matches []apiMatch `json:"matches"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("decode football-data.org %s: %w", competitionCode, err)
	}
	matches := make([]Match, 0, len(body.Matches))
	for _, m := range body.Matches {
		matches = append(matches, toMatch(m))
	}
	return matches, nil
}

func (c *Client) waitForSlot(ctx context.Context) error {
	next := c.blockedUntil
	if !c.lastCall.IsZero() && c.lastCall.Add(minCallInterval).After(next) {
		next = c.lastCall.Add(minCallInterval)
	}
	if wait := next.Sub(c.now()); wait > 0 {
		return c.sleep(ctx, wait)
	}
	return nil
}

func (c *Client) readQuota(h http.Header) {
	if h.Get(headerAvailable) == "0" {
		c.blockedUntil = c.now().Add(resetAfter(h))
	}
}

func resetAfter(h http.Header) time.Duration {
	seconds, err := strconv.Atoi(h.Get(headerResetAfter))
	if err != nil || seconds <= 0 {
		return time.Minute
	}
	return time.Duration(seconds) * time.Second
}

func toMatch(m apiMatch) Match {
	match := Match{
		ID:          m.ID,
		Kickoff:     m.UTCDate.UTC(),
		Status:      m.Status,
		Stage:       m.Stage,
		HomeTeam:    TeamName(m.HomeTeam.ShortName, m.HomeTeam.Name),
		AwayTeam:    TeamName(m.AwayTeam.ShortName, m.AwayTeam.Name),
		HomeGoals:   m.Score.FullTime.Home,
		AwayGoals:   m.Score.FullTime.Away,
		LastUpdated: m.LastUpdated,
	}
	if m.Matchday != nil {
		match.Matchday = *m.Matchday
	}
	return match
}
