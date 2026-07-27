package service

import (
	"bytes"
	"encoding/csv"
	"slices"
	"strconv"
	"testing"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

func intPtr(v int) *int { return &v }

func exportMatch(home, away string, homeGoals, awayGoals int, closesAt *time.Time) models.Match {
	return models.Match{
		ID:             uuid.New(),
		Round:          1,
		HomeTeam:       home,
		AwayTeam:       away,
		MarketClosesAt: closesAt,
		HomeGoals:      intPtr(homeGoals),
		AwayGoals:      intPtr(awayGoals),
	}
}

func exportUser(name string) models.User {
	return models.User{ID: uuid.New(), Username: name, DisplayName: name}
}

// FieldsPerRecord = -1 because each section of the CSV has a different column count.
func parseCSV(t *testing.T, raw []byte) [][]string {
	t.Helper()
	r := csv.NewReader(bytes.NewReader(bytes.TrimPrefix(raw, []byte{0xEF, 0xBB, 0xBF})))
	r.Comma = ';'
	r.FieldsPerRecord = -1
	records, err := r.ReadAll()
	if err != nil {
		t.Fatalf("generated CSV does not parse: %v", err)
	}
	return records
}

func findRow(records [][]string, col int, want string, minLen int) []string {
	for _, rec := range records {
		if len(rec) >= minLen && rec[col] == want {
			return rec
		}
	}
	return nil
}

// The section ends at the next header: encoding/csv discards the blank lines separating
// the sections, so they cannot be used as the delimiter.
func sectionAfter(records [][]string, header string) [][]string {
	start := -1
	for i, rec := range records {
		if slices.Contains(rec, header) {
			start = i + 1
			break
		}
	}
	if start < 0 {
		return nil
	}
	for i := start; i < len(records); i++ {
		if len(records[i]) > 0 && records[i][0] == "Rodada" {
			return records[start:i]
		}
	}
	return records[start:]
}

// The round is 0-0 plus 0-1 on purpose: the predicted goal total (0) does not match the
// actual one (1), so the round bonus stays out and the PALPITES rows must sum to exactly
// the CLASSIFICAÇÃO total.
func TestBuildCSVPalpitesAgreeWithClassification(t *testing.T) {
	now := testNow
	closed := timePtr(now.Add(-time.Hour))
	matches := []models.Match{
		exportMatch("Vitória", "Remo", 0, 0, closed),
		exportMatch("Atlético-MG", "Palmeiras", 0, 1, closed),
	}
	ana := exportUser("Ana")

	raw, err := buildCSV([]int{1}, matches, []models.User{ana}, nil, now)
	if err != nil {
		t.Fatalf("buildCSV: %v", err)
	}
	records := parseCSV(t, raw)

	palpites := sectionAfter(records, "Palpite_Mandante")
	sum := 0
	rows := 0
	for _, rec := range palpites {
		if len(rec) < 6 || rec[2] != "Ana" {
			continue
		}
		rows++
		if rec[3] != "0" || rec[4] != "0" {
			t.Errorf("no-show prediction = %s×%s, want 0×0", rec[3], rec[4])
		}
		pts, err := strconv.Atoi(rec[5])
		if err != nil {
			t.Fatalf("non-numeric points in %q: %v", rec, err)
		}
		sum += pts
	}
	if rows != 2 {
		t.Fatalf("%d prediction rows for Ana, want 2", rows)
	}
	if sum != 21 {
		t.Errorf("PALPITES sum = %d, want 21 (18 on the 0-0 + 3 on the 0-1)", sum)
	}

	classification := findRow(sectionAfter(records, "Posicao"), 2, "Ana", 6)
	if classification == nil {
		t.Fatal("Ana is missing from the classification")
	}
	if classification[3] != strconv.Itoa(sum) {
		t.Errorf("CLASSIFICAÇÃO says %s points and PALPITES sums to %d — the two sections of the same CSV disagree",
			classification[3], sum)
	}
}

func TestBuildCSVOpenMarketPrintsDash(t *testing.T) {
	now := testNow
	m := exportMatch("Vitória", "Remo", 0, 0, nil)
	ana := exportUser("Ana")

	raw, err := buildCSV([]int{1}, []models.Match{m}, []models.User{ana}, nil, now)
	if err != nil {
		t.Fatalf("buildCSV: %v", err)
	}

	palpite := findRow(parseCSV(t, raw), 2, "Ana", 6)
	if palpite == nil {
		t.Fatal("no prediction row for Ana")
	}
	if palpite[3] != "-" || palpite[4] != "-" {
		t.Errorf("prediction with an open market = %s×%s, want -×-", palpite[3], palpite[4])
	}
	if palpite[5] != "0" {
		t.Errorf("points with an open market = %s, want 0", palpite[5])
	}
}

func TestBuildCSVKeepsRealPredictions(t *testing.T) {
	now := testNow
	closed := timePtr(now.Add(-time.Hour))
	m := exportMatch("Vitória", "Remo", 2, 1, closed)
	ana := exportUser("Ana")
	pred := models.Prediction{
		ID: uuid.New(), UserID: ana.ID, MatchID: m.ID, HomeGoals: 2, AwayGoals: 1,
	}

	raw, err := buildCSV([]int{1}, []models.Match{m}, []models.User{ana}, []models.Prediction{pred}, now)
	if err != nil {
		t.Fatalf("buildCSV: %v", err)
	}
	palpite := findRow(parseCSV(t, raw), 2, "Ana", 6)
	if palpite == nil {
		t.Fatal("no prediction row for Ana")
	}
	if palpite[3] != "2" || palpite[4] != "1" || palpite[5] != "18" {
		t.Errorf("exact prediction = %s×%s for %s points, want 2×1 for 18", palpite[3], palpite[4], palpite[5])
	}
}

func TestGetRoundClassificationNoShowAfterClose(t *testing.T) {
	now := testNow
	closed := timePtr(now.Add(-time.Hour))
	matches := []models.Match{
		exportMatch("Vitória", "Remo", 0, 0, closed),
		exportMatch("Atlético-MG", "Palmeiras", 0, 1, closed),
	}
	ana := exportUser("Ana")

	rows := getRoundClassification(matches, []models.User{ana}, indexPredictions(nil), now)
	if len(rows) != 1 {
		t.Fatalf("classification has %d rows, want 1 (the no-show scores and is not filtered out)", len(rows))
	}
	if rows[0].points != 21 {
		t.Errorf("no-show points = %d, want 21 (18 + 3)", rows[0].points)
	}
}

func TestGetRoundClassificationNoShowOpenMarket(t *testing.T) {
	now := testNow
	matches := []models.Match{
		exportMatch("Vitória", "Remo", 0, 0, nil),
		exportMatch("Atlético-MG", "Palmeiras", 0, 1, nil),
	}
	ana := exportUser("Ana")

	rows := getRoundClassification(matches, []models.User{ana}, indexPredictions(nil), now)
	if len(rows) != 0 {
		t.Errorf("no-show with an open market appeared in the classification: %+v", rows)
	}
}
