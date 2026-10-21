package handler

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

func TestPartialRows_CarryTheMatchStatusSoClientsKnowARoundIsLive(t *testing.T) {
	live := models.Match{ID: uuid.New(), HomeTeam: "Bahia", AwayTeam: "Santos", Status: models.MatchStatusLive}
	one, zero := 1, 0
	rows := partialRows([]models.Match{live}, map[uuid.UUID]models.MatchPartial{live.ID: {MatchID: live.ID, HomeGoals: &one, AwayGoals: &zero}})

	body, err := json.Marshal(rows)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	for _, want := range []string{`"status":"live"`, `"partial_home":1`, `"partial_away":0`} {
		if !strings.Contains(string(body), want) {
			t.Errorf("body = %s, want %s", body, want)
		}
	}
}

func TestPartialRows_SkipAPartialWithoutBothScores(t *testing.T) {
	m := models.Match{ID: uuid.New(), Status: models.MatchStatusTimed}
	one := 1
	rows := partialRows([]models.Match{m}, map[uuid.UUID]models.MatchPartial{m.ID: {MatchID: m.ID, HomeGoals: &one}})
	if len(rows) != 1 || rows[0].PartialHome != nil || rows[0].PartialAway != nil {
		t.Errorf("rows = %+v, want one row without a partial", rows)
	}
}
