package service

import (
	"bytes"
	"context"
	"encoding/csv"
	"strconv"

	"github.com/bolao-app/api/internal/models"
	"github.com/bolao-app/api/internal/repository"
	"github.com/google/uuid"
)

type ExportService struct {
	bolaoRepo      *repository.BolaoRepository
	matchRepo      *repository.MatchRepository
	predictionRepo *repository.PredictionRepository
}

func NewExportService(
	bolaoRepo *repository.BolaoRepository,
	matchRepo *repository.MatchRepository,
	predictionRepo *repository.PredictionRepository,
) *ExportService {
	return &ExportService{
		bolaoRepo:      bolaoRepo,
		matchRepo:      matchRepo,
		predictionRepo: predictionRepo,
	}
}

func (s *ExportService) ExportRoundCSV(ctx context.Context, bolaoID uuid.UUID, round int) ([]byte, error) {
	matches, err := s.matchRepo.ListByRound(ctx, bolaoID, round)
	if err != nil {
		return nil, err
	}

	participants, err := s.bolaoRepo.ListParticipants(ctx, bolaoID)
	if err != nil {
		return nil, err
	}
	users := participantUsers(participants)

	predictions, err := s.predictionRepo.GetAllForBolao(ctx, bolaoID)
	if err != nil {
		return nil, err
	}

	return buildCSV([]int{round}, matches, users, predictions)
}

func (s *ExportService) ExportAllCSV(ctx context.Context, bolaoID uuid.UUID) ([]byte, error) {
	rounds, err := s.matchRepo.ListRounds(ctx, bolaoID)
	if err != nil {
		return nil, err
	}

	allMatches, err := s.matchRepo.ListAllByBolao(ctx, bolaoID)
	if err != nil {
		return nil, err
	}

	participants, err := s.bolaoRepo.ListParticipants(ctx, bolaoID)
	if err != nil {
		return nil, err
	}
	users := participantUsers(participants)

	predictions, err := s.predictionRepo.GetAllForBolao(ctx, bolaoID)
	if err != nil {
		return nil, err
	}

	return buildCSV(rounds, allMatches, users, predictions)
}

func participantUsers(participants []models.ParticipantView) []models.User {
	users := make([]models.User, 0, len(participants))
	for _, p := range participants {
		users = append(users, p.User)
	}
	return users
}

// indexPredictions groups predictions by user then match for O(1) lookup, avoiding a
// query per match/round per user (see buildCSV and getRoundClassification below).
func indexPredictions(predictions []models.Prediction) map[uuid.UUID]map[uuid.UUID]struct{ Home, Away int } {
	index := make(map[uuid.UUID]map[uuid.UUID]struct{ Home, Away int })
	for _, p := range predictions {
		if index[p.UserID] == nil {
			index[p.UserID] = make(map[uuid.UUID]struct{ Home, Away int })
		}
		index[p.UserID][p.MatchID] = struct{ Home, Away int }{p.HomeGoals, p.AwayGoals}
	}
	return index
}

func buildCSV(rounds []int, matches []models.Match, users []models.User, predictions []models.Prediction) ([]byte, error) {
	predIndex := indexPredictions(predictions)

	var buf bytes.Buffer
	w := csv.NewWriter(&buf)
	w.Comma = ';'

	// JOGOS
	_ = w.Write([]string{"Rodada", "Mandante", "Visitante", "Gols_Mandante", "Gols_Visitante"})
	for _, m := range matches {
		hg, ag := "-", "-"
		if m.HomeGoals != nil {
			hg = strconv.Itoa(*m.HomeGoals)
		}
		if m.AwayGoals != nil {
			ag = strconv.Itoa(*m.AwayGoals)
		}
		_ = w.Write([]string{
			strconv.Itoa(m.Round),
			m.HomeTeam,
			m.AwayTeam,
			hg,
			ag,
		})
	}
	_ = w.Write(nil)

	// PALPITES (apenas jogos com resultado)
	_ = w.Write([]string{"Rodada", "Jogo", "Usuario", "Palpite_Mandante", "Palpite_Visitante", "Pontos"})
	for _, m := range matches {
		if m.HomeGoals == nil || m.AwayGoals == nil {
			continue
		}
		hg, ag := *m.HomeGoals, *m.AwayGoals
		jogo := m.HomeTeam + " x " + m.AwayTeam

		for _, u := range users {
			p := predIndex[u.ID][m.ID]
			pts := CalculateMatchPoints(p.Home, p.Away, hg, ag)
			_ = w.Write([]string{
				strconv.Itoa(m.Round),
				jogo,
				u.DisplayName,
				strconv.Itoa(p.Home),
				strconv.Itoa(p.Away),
				strconv.Itoa(pts),
			})
		}
	}
	_ = w.Write(nil)

	// CLASSIFICAÇÃO por rodada
	_ = w.Write([]string{"Rodada", "Posicao", "Usuario", "Pontos", "Placares_Exatos", "Resultados_Corretos"})
	matchesByRound := make(map[int][]models.Match)
	for _, m := range matches {
		matchesByRound[m.Round] = append(matchesByRound[m.Round], m)
	}
	for _, round := range rounds {
		classification := getRoundClassification(matchesByRound[round], users, predIndex)
		if len(classification) == 0 {
			continue
		}
		for i, row := range classification {
			_ = w.Write([]string{
				strconv.Itoa(round),
				strconv.Itoa(i + 1),
				row.displayName,
				strconv.Itoa(row.points),
				strconv.Itoa(row.exactScores),
				strconv.Itoa(row.correctResults),
			})
		}
	}

	w.Flush()
	if err := w.Error(); err != nil {
		return nil, err
	}

	// BOM for Excel UTF-8
	result := append([]byte{0xEF, 0xBB, 0xBF}, buf.Bytes()...)
	return result, nil
}

type classRow struct {
	displayName    string
	points         int
	exactScores    int
	correctResults int
}

func getRoundClassification(
	matches []models.Match,
	users []models.User,
	predIndex map[uuid.UUID]map[uuid.UUID]struct{ Home, Away int },
) []classRow {
	hasResults := len(matches) > 0
	for _, m := range matches {
		if m.HomeGoals == nil || m.AwayGoals == nil {
			hasResults = false
			break
		}
	}
	if !hasResults {
		return nil
	}

	type userScore struct {
		user           models.User
		points         int
		exactScores    int
		correctResults int
	}
	scores := make([]userScore, 0, len(users))

	for _, user := range users {
		predByMatch := predIndex[user.ID]
		const noPred = -1
		var predList []struct{ PredHome, PredAway int }
		var matchList []struct{ HomeGoals, AwayGoals int }
		for _, m := range matches {
			p, has := predByMatch[m.ID]
			if !has {
				predList = append(predList, struct{ PredHome, PredAway int }{noPred, noPred})
			} else {
				predList = append(predList, struct{ PredHome, PredAway int }{p.Home, p.Away})
			}
			hg, ag := 0, 0
			if m.HomeGoals != nil {
				hg = *m.HomeGoals
			}
			if m.AwayGoals != nil {
				ag = *m.AwayGoals
			}
			matchList = append(matchList, struct{ HomeGoals, AwayGoals int }{hg, ag})
		}
		pts, exact, correct := CalculateRoundPoints(predList, matchList, true)
		scores = append(scores, userScore{user, pts, exact, correct})
	}

	// Sort by points desc, then exact, then correct
	for i := 0; i < len(scores); i++ {
		for j := i + 1; j < len(scores); j++ {
			a, b := scores[i], scores[j]
			swap := false
			if b.points > a.points {
				swap = true
			} else if b.points == a.points && b.exactScores > a.exactScores {
				swap = true
			} else if b.points == a.points && b.exactScores == a.exactScores && b.correctResults > a.correctResults {
				swap = true
			}
			if swap {
				scores[i], scores[j] = scores[j], scores[i]
			}
		}
	}

	result := make([]classRow, 0, len(scores))
	for _, sc := range scores {
		if sc.points == 0 {
			continue
		}
		result = append(result, classRow{
			displayName:    sc.user.DisplayName,
			points:         sc.points,
			exactScores:    sc.exactScores,
			correctResults: sc.correctResults,
		})
	}
	return result
}
