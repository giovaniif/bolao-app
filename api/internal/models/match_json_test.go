package models

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestMatchJSON_ShowsTheFeedLinkAndTheLock(t *testing.T) {
	id := int64(554740)
	body, err := json.Marshal(Match{ProviderMatchID: &id, Locked: true})
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	for _, want := range []string{`"provider_match_id":554740`, `"locked":true`} {
		if !strings.Contains(string(body), want) {
			t.Errorf("json = %s, want it to contain %s", body, want)
		}
	}
}

func TestMatchJSON_AManualMatchHasNoFeedLink(t *testing.T) {
	body, err := json.Marshal(Match{})
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	if strings.Contains(string(body), "provider_match_id") {
		t.Errorf("json = %s, want no provider_match_id", body)
	}
}
