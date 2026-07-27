package service

import (
	"testing"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

var testNow = time.Date(2026, 7, 27, 15, 0, 0, 0, time.UTC)

func matchClosingAt(closesAt *time.Time) models.Match {
	return models.Match{ID: uuid.New(), MarketClosesAt: closesAt}
}

func timePtr(t time.Time) *time.Time { return &t }

func TestMarketClosed(t *testing.T) {
	equal := testNow
	tests := []struct {
		name     string
		closesAt *time.Time
		want     bool
	}{
		{"sem data de fechamento = aberto", nil, false},
		{"fecha daqui uma hora", timePtr(testNow.Add(time.Hour)), false},
		{"fecha exatamente agora", timePtr(equal), false}, // After é estrito
		{"fechou uma hora atrás", timePtr(testNow.Add(-time.Hour)), true},
	}
	for _, tt := range tests {
		if got := MarketClosed(matchClosingAt(tt.closesAt), testNow); got != tt.want {
			t.Errorf("MarketClosed(%s) = %v, want %v", tt.name, got, tt.want)
		}
	}
}

func TestEffectivePrediction(t *testing.T) {
	closed := timePtr(testNow.Add(-time.Hour))
	open := timePtr(testNow.Add(time.Hour))

	tests := []struct {
		name               string
		closesAt           *time.Time
		predHome, predAway int
		hasPred            bool
		wantHome, wantAway int
		wantCounts         bool
	}{
		{"palpite salvo, mercado aberto", open, 2, 1, true, 2, 1, true},
		{"palpite salvo, mercado fechado", closed, 2, 1, true, 2, 1, true},
		{"sem palpite, mercado fechado vira 0×0", closed, 0, 0, false, 0, 0, true},
		{"sem palpite, mercado aberto não conta", open, 0, 0, false, 0, 0, false},
		// A aresta afiada: sem data de fechamento o jogador ainda pode palpitar,
		// então não pode levar 0×0.
		{"sem palpite, sem data de fechamento não conta", nil, 0, 0, false, 0, 0, false},
	}
	for _, tt := range tests {
		m := matchClosingAt(tt.closesAt)
		home, away, counts := EffectivePrediction(m, tt.predHome, tt.predAway, tt.hasPred, testNow)
		if home != tt.wantHome || away != tt.wantAway || counts != tt.wantCounts {
			t.Errorf("EffectivePrediction(%s) = (%d,%d,%v), want (%d,%d,%v)",
				tt.name, home, away, counts, tt.wantHome, tt.wantAway, tt.wantCounts)
		}
	}
}

func TestEffectivePredEntry(t *testing.T) {
	closed := matchClosingAt(timePtr(testNow.Add(-time.Hour)))
	open := matchClosingAt(timePtr(testNow.Add(time.Hour)))
	never := matchClosingAt(nil)

	if got := EffectivePredEntry(closed, 0, 0, false, testNow); got.PredHome != 0 || got.PredAway != 0 {
		t.Errorf("ausente + fechado = %v, want {0,0}", got)
	}
	if got := EffectivePredEntry(open, 0, 0, false, testNow); got.PredHome != noPredSentinel {
		t.Errorf("ausente + aberto = %v, want sentinela", got)
	}
	if got := EffectivePredEntry(never, 0, 0, false, testNow); got.PredHome != noPredSentinel {
		t.Errorf("ausente + sem data = %v, want sentinela", got)
	}
	if got := EffectivePredEntry(closed, 3, 1, true, testNow); got.PredHome != 3 || got.PredAway != 1 {
		t.Errorf("palpite salvo = %v, want {3,1}", got)
	}
}

// TestNoShowMatchPoints fixa quanto um 0×0 sintetizado vale por jogo — é o que muda
// a classificação quando esta regra entra no ar.
func TestNoShowMatchPoints(t *testing.T) {
	tests := []struct {
		realHome, realAway int
		want               int
	}{
		{0, 0, 18}, // 9 resultado + 3 mandante + 3 visitante + 3 placar exato
		{1, 1, 12}, // empate sem acertar o placar
		{0, 1, 3},  // só gols do mandante
		{2, 2, 12}, // empate sem placar, 4 gols mas total previsto errado
		{2, 1, 0},  // nada
	}
	for _, tt := range tests {
		if got := CalculateMatchPoints(0, 0, tt.realHome, tt.realAway); got != tt.want {
			t.Errorf("0×0 contra %d-%d = %d, want %d", tt.realHome, tt.realAway, got, tt.want)
		}
	}
}

func TestNoShowRoundScoring(t *testing.T) {
	closedMatches := []models.Match{
		matchClosingAt(timePtr(testNow.Add(-time.Hour))),
		matchClosingAt(timePtr(testNow.Add(-time.Hour))),
	}
	results := []MatchScore{{HomeGoals: 0, AwayGoals: 0}, {HomeGoals: 0, AwayGoals: 1}}

	var preds []PredEntry
	for _, m := range closedMatches {
		preds = append(preds, EffectivePredEntry(m, 0, 0, false, testNow))
	}
	points, exact, correct := CalculateRoundPoints(preds, results, true)
	// 18 + 3 = 21. Sem bônus de total de gols (0 previsto vs 1 real) e só um tipo
	// de placar exato, que vale 0.
	if points != 21 || exact != 1 || correct != 1 {
		t.Errorf("rodada fechada sem palpites = (%d,%d,%d), want (21,1,1)", points, exact, correct)
	}

	// Mesma rodada com mercado nunca fechado: o ausente não pontua nada.
	openMatches := []models.Match{matchClosingAt(nil), matchClosingAt(nil)}
	preds = nil
	for _, m := range openMatches {
		preds = append(preds, EffectivePredEntry(m, 0, 0, false, testNow))
	}
	points, exact, correct = CalculateRoundPoints(preds, results, true)
	if points != 0 || exact != 0 || correct != 0 {
		t.Errorf("rodada aberta sem palpites = (%d,%d,%d), want (0,0,0)", points, exact, correct)
	}
}

// TestRoundTotalBonusNeedsAtLeastOnePrediction cobre o bug em que uma rodada inteira
// 0-0 dava os 10 pontos de "acertou o total de gols" para quem não palpitou nada:
// roundPredTotal (0) batia com actualRoundTotal (0).
func TestRoundTotalBonusNeedsAtLeastOnePrediction(t *testing.T) {
	preds := []PredEntry{
		{PredHome: noPredSentinel, PredAway: noPredSentinel},
		{PredHome: noPredSentinel, PredAway: noPredSentinel},
	}
	results := []MatchScore{{HomeGoals: 0, AwayGoals: 0}, {HomeGoals: 0, AwayGoals: 0}}
	if points, _, _ := CalculateRoundPoints(preds, results, true); points != 0 {
		t.Errorf("ausente total em rodada 0-0 = %d pontos, want 0", points)
	}
}

func TestFillMissingPredictions(t *testing.T) {
	userID := uuid.New()
	closed := matchClosingAt(timePtr(testNow.Add(-time.Hour)))
	open := matchClosingAt(timePtr(testNow.Add(time.Hour)))
	never := matchClosingAt(nil)
	answered := matchClosingAt(timePtr(testNow.Add(-time.Hour)))

	stored := models.Prediction{
		ID: uuid.New(), UserID: userID, MatchID: answered.ID, HomeGoals: 3, AwayGoals: 1,
	}

	got := FillMissingPredictions(
		[]models.Match{answered, closed, open, never},
		userID,
		[]models.Prediction{stored},
		testNow,
	)

	// answered mantém a linha salva, closed vira 0×0, open e never ficam de fora.
	if len(got) != 2 {
		t.Fatalf("FillMissingPredictions devolveu %d entradas, want 2: %+v", len(got), got)
	}
	if got[0].MatchID != answered.ID || got[0].HomeGoals != 3 || got[0].AwayGoals != 1 || got[0].AutoFilled {
		t.Errorf("palpite salvo foi alterado: %+v", got[0])
	}
	if got[1].MatchID != closed.ID || got[1].HomeGoals != 0 || got[1].AwayGoals != 0 || !got[1].AutoFilled {
		t.Errorf("jogo fechado sem palpite = %+v, want 0×0 AutoFilled", got[1])
	}
	if got[1].ID != uuid.Nil {
		t.Errorf("palpite sintetizado não deve ter ID de linha, got %v", got[1].ID)
	}
	if got[1].UserID != userID {
		t.Errorf("palpite sintetizado com UserID errado: %v", got[1].UserID)
	}
}

func TestFillMissingPredictionsNeverNil(t *testing.T) {
	got := FillMissingPredictions(nil, uuid.New(), nil, testNow)
	if got == nil {
		t.Error("FillMissingPredictions devolveu nil; o handler conta com slice não-nula para serializar []")
	}
}
