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

// exportMatch monta um jogo da rodada 1 com placar final e a data de fechamento dada.
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

// parseCSV desfaz o BOM e lê o arquivo inteiro. FieldsPerRecord = -1 porque o CSV
// separa as seções com linhas em branco e cada seção tem um número de colunas diferente.
func parseCSV(t *testing.T, raw []byte) [][]string {
	t.Helper()
	r := csv.NewReader(bytes.NewReader(bytes.TrimPrefix(raw, []byte{0xEF, 0xBB, 0xBF})))
	r.Comma = ';'
	r.FieldsPerRecord = -1
	records, err := r.ReadAll()
	if err != nil {
		t.Fatalf("CSV gerado não é parseável: %v", err)
	}
	return records
}

// findRow devolve a primeira linha cujo campo `col` é igual a `want` e que tem pelo
// menos `minLen` colunas — usado para achar a linha de um usuário dentro de uma seção.
func findRow(records [][]string, col int, want string, minLen int) []string {
	for _, rec := range records {
		if len(rec) >= minLen && rec[col] == want {
			return rec
		}
	}
	return nil
}

// sectionAfter devolve só as linhas de dados da seção cujo cabeçalho contém `header`.
// As seções PALPITES e CLASSIFICAÇÃO têm a mesma largura, então procurar "Ana" no
// arquivo inteiro acharia a linha errada. A seção termina no cabeçalho seguinte —
// encoding/csv descarta as linhas em branco que separam as seções, então elas não
// servem de delimitador.
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

// TestBuildCSVPalpitesAgreeWithClassification trava as duas seções do mesmo arquivo.
// Antes desta mudança a seção PALPITES lia o mapa com um valor só, então um ausente
// virava {0,0} e pontuava, enquanto a CLASSIFICAÇÃO logo abaixo usava a sentinela e
// dava 0 para o mesmo jogador no mesmo arquivo.
//
// A rodada é 0-0 + 0-1 de propósito: o total de gols previsto (0) não bate com o real
// (1), então o bônus de rodada não entra e a soma das linhas de PALPITES tem que ser
// exatamente igual ao total da CLASSIFICAÇÃO.
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

	// Seção PALPITES: Rodada;Jogo;Usuario;Palpite_Mandante;Palpite_Visitante;Pontos
	palpites := sectionAfter(records, "Palpite_Mandante")
	somaPalpites := 0
	linhas := 0
	for _, rec := range palpites {
		if len(rec) < 6 || rec[2] != "Ana" {
			continue
		}
		linhas++
		if rec[3] != "0" || rec[4] != "0" {
			t.Errorf("palpite do ausente = %s×%s, want 0×0", rec[3], rec[4])
		}
		pts, err := strconv.Atoi(rec[5])
		if err != nil {
			t.Fatalf("pontos não numéricos em %q: %v", rec, err)
		}
		somaPalpites += pts
	}
	if linhas != 2 {
		t.Fatalf("%d linhas de palpite para Ana, want 2", linhas)
	}
	if somaPalpites != 21 {
		t.Errorf("soma da seção PALPITES = %d, want 21 (18 no 0-0 + 3 no 0-1)", somaPalpites)
	}

	// Seção CLASSIFICAÇÃO: Rodada;Posicao;Usuario;Pontos;...
	classificacao := findRow(sectionAfter(records, "Posicao"), 2, "Ana", 6)
	if classificacao == nil {
		t.Fatal("Ana não aparece na classificação")
	}
	if classificacao[3] != strconv.Itoa(somaPalpites) {
		t.Errorf("CLASSIFICAÇÃO diz %s pontos e PALPITES soma %d — as duas seções do mesmo CSV discordam",
			classificacao[3], somaPalpites)
	}
}

// TestBuildCSVOpenMarketPrintsDash cobre a aresta do mercado sem data de fechamento:
// o jogador ainda pode palpitar, então não pode aparecer com 0×0 nem pontuar.
func TestBuildCSVOpenMarketPrintsDash(t *testing.T) {
	now := testNow
	m := exportMatch("Vitória", "Remo", 0, 0, nil) // sem market_closes_at
	ana := exportUser("Ana")

	raw, err := buildCSV([]int{1}, []models.Match{m}, []models.User{ana}, nil, now)
	if err != nil {
		t.Fatalf("buildCSV: %v", err)
	}
	records := parseCSV(t, raw)

	palpite := findRow(records, 2, "Ana", 6)
	if palpite == nil {
		t.Fatal("nenhuma linha de palpite para Ana")
	}
	if palpite[3] != "-" || palpite[4] != "-" {
		t.Errorf("palpite com mercado aberto = %s×%s, want -×-", palpite[3], palpite[4])
	}
	if palpite[5] != "0" {
		t.Errorf("pontos com mercado aberto = %s, want 0", palpite[5])
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
		t.Fatal("nenhuma linha de palpite para Ana")
	}
	if palpite[3] != "2" || palpite[4] != "1" || palpite[5] != "18" {
		t.Errorf("palpite exato = %s×%s por %s pontos, want 2×1 por 18", palpite[3], palpite[4], palpite[5])
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
		t.Fatalf("classificação com %d linhas, want 1 (o ausente pontua e não é filtrado)", len(rows))
	}
	if rows[0].points != 21 {
		t.Errorf("pontos do ausente = %d, want 21 (18 + 3)", rows[0].points)
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
		t.Errorf("ausente com mercado aberto apareceu na classificação: %+v", rows)
	}
}
