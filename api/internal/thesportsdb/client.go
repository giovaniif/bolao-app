package thesportsdb

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/bolao-app/api/internal/service"
)

const DefaultBaseURL = "https://www.thesportsdb.com"

var leagueIDs = map[string]string{
	"BSA": "4351",
	"CL":  "4480",
}

var statuses = map[string]string{
	"FT":             service.FeedStatusFinished,
	"AET":            service.FeedStatusFinished,
	"PEN":            service.FeedStatusFinished,
	"Match Finished": service.FeedStatusFinished,
	"1H":             service.FeedStatusInPlay,
	"HT":             service.FeedStatusInPlay,
	"2H":             service.FeedStatusInPlay,
	"ET":             service.FeedStatusInPlay,
	"BT":             service.FeedStatusInPlay,
	"P":              service.FeedStatusInPlay,
	"LIVE":           service.FeedStatusInPlay,
}

type Client struct {
	baseURL string
	key     string
	http    *http.Client
}

func NewClient(baseURL, key string) *Client {
	return &Client{baseURL: baseURL, key: key, http: &http.Client{Timeout: 20 * time.Second}}
}

type apiEvent struct {
	Timestamp string  `json:"strTimestamp"`
	HomeTeam  string  `json:"strHomeTeam"`
	AwayTeam  string  `json:"strAwayTeam"`
	HomeScore *string `json:"intHomeScore"`
	AwayScore *string `json:"intAwayScore"`
	Status    string  `json:"strStatus"`
}

func (c *Client) ResultsOn(ctx context.Context, code string, day time.Time) ([]service.FeedResult, error) {
	league, ok := leagueIDs[code]
	if !ok {
		return nil, fmt.Errorf("thesportsdb: no league for competition %s", code)
	}
	endpoint := fmt.Sprintf("%s/api/v1/json/%s/eventsday.php?d=%s&l=%s",
		c.baseURL, url.PathEscape(c.key), day.UTC().Format(time.DateOnly), league)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("thesportsdb %s: status %d", code, resp.StatusCode)
	}
	var body struct {
		Events []apiEvent `json:"events"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("decode thesportsdb %s: %w", code, err)
	}
	results := make([]service.FeedResult, 0, len(body.Events))
	for _, e := range body.Events {
		results = append(results, toResult(e))
	}
	return results, nil
}

func toResult(e apiEvent) service.FeedResult {
	kickoff, _ := time.Parse("2006-01-02T15:04:05", e.Timestamp)
	r := service.FeedResult{Kickoff: kickoff, HomeTeam: e.HomeTeam, AwayTeam: e.AwayTeam}
	status, ok := statuses[e.Status]
	home, homeOK := score(e.HomeScore)
	away, awayOK := score(e.AwayScore)
	if !ok || !homeOK || !awayOK {
		return r
	}
	r.Status = status
	r.HomeGoals = &home
	r.AwayGoals = &away
	return r
}

func score(s *string) (int, bool) {
	if s == nil {
		return 0, false
	}
	n, err := strconv.Atoi(*s)
	return n, err == nil
}
