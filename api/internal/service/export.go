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

	return s.buildCSV(ctx, bolaoID, []int{round}, matches, users)
}

func (s *ExportService) ExportAllCSV(ctx context.Context, bolaoID uuid.UUID) ([]byte, error) {
	rounds, err := s.matchRepo.ListRounds(ctx, bolaoID)
	if err != nil {
		return nil, err
	}

	var allMatches []models.Match
	for _, r := range rounds {
		matches, err := s.matchRepo.ListByRound(ctx, bolaoID, r)
		if err != nil {
			return nil, err
		}
		allMatches = append(allMatches, matches...)
	}

	participants, err := s.bolaoRepo.ListParticipants(ctx, bolaoID)
	if err != nil {
		return nil, err
	}
	users := participantUsers(participants)

	return s.buildCSV(ctx, bolaoID, rounds, allMatches, users)
}

func participantUsers(participants []models.ParticipantView) []models.User {
	users := make([]models.User, 0, len(participants))
	for _, p := range participants {
		users = append(users, p.User)
	}
	return users
}

func (s *ExportService) buildCSV(ctx context.Context, bolaoID uuid.UUID, rounds []int, matches []models.Match, users []models.User) ([]byte, error) {
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
	matchByID := make(map[uuid.UUID]models.Match)
	for _, m := range matches {
		matchByID[m.ID] = m
	}

	for _, m := range matches {
		if m.HomeGoals == nil || m.AwayGoals == nil {
			continue
		}
		hg, ag := *m.HomeGoals, *m.AwayGoals
		jogo := m.HomeTeam + " x " + m.AwayTeam

		for _, u := range users {
			preds, _ := s.predictionRepo.GetByUserAndRound(ctx, u.ID, bolaoID, m.Round)
			predByMatch := make(map[uuid.UUID]struct{ Home, Away int })
			for _, p := range preds {
				predByMatch[p.MatchID] = struct{ Home, Away int }{p.HomeGoals, p.AwayGoals}
			}
			p := predByMatch[m.ID]
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
	for _, round := range rounds {
		classification, err := s.getRoundClassification(ctx, bolaoID, round, users)
		if err != nil || len(classification) == 0 {
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

func (s *ExportService) getRoundClassification(ctx context.Context, bolaoID uuid.UUID, round int, users []models.User) ([]classRow, error) {
	matches, err := s.matchRepo.ListByRound(ctx, bolaoID, round)
	if err != nil {
		return nil, err
	}
	hasResults := len(matches) > 0
	for _, m := range matches {
		if m.HomeGoals == nil || m.AwayGoals == nil {
			hasResults = false
			break
		}
	}
	if !hasResults {
		return nil, nil
	}

	type userScore struct {
		user           models.User
		points         int
		exactScores    int
		correctResults int
	}
	scores := make([]userScore, 0, len(users))

	for _, user := range users {
		preds, err := s.predictionRepo.GetByUserAndRound(ctx, user.ID, bolaoID, round)
		if err != nil {
			return nil, err
		}
		predByMatch := make(map[uuid.UUID]struct{ Home, Away int })
		for _, p := range preds {
			predByMatch[p.MatchID] = struct{ Home, Away int }{p.HomeGoals, p.AwayGoals}
		}
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
	return result, nil
}
