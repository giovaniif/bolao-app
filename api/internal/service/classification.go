package service

import (
	"context"
	"sort"
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/bolao-app/api/internal/repository"
	"github.com/google/uuid"
)

type matchWithResult struct {
	m          models.Match
	home, away int
}

type ClassificationService struct {
	bolaoRepo      *repository.BolaoRepository
	matchRepo      *repository.MatchRepository
	predictionRepo *repository.PredictionRepository
	partialRepo    *repository.PartialRepository
}

func NewClassificationService(
	bolaoRepo *repository.BolaoRepository,
	matchRepo *repository.MatchRepository,
	predictionRepo *repository.PredictionRepository,
	partialRepo *repository.PartialRepository,
) *ClassificationService {
	return &ClassificationService{
		bolaoRepo:      bolaoRepo,
		matchRepo:      matchRepo,
		predictionRepo: predictionRepo,
		partialRepo:    partialRepo,
	}
}

type RoundScore struct {
	UserID         uuid.UUID `json:"user_id"`
	Round          int       `json:"round"`
	Points         int       `json:"points"`
	ExactScores    int       `json:"exact_scores"`
	CorrectResults int       `json:"correct_results"`
}

func (s *ClassificationService) GetClassification(ctx context.Context, bolaoID uuid.UUID, upToRound int) ([]models.UserWithStats, error) {
	// Fetch everything for the bolão in bulk (3 queries total, regardless of round count)
	// instead of one query per round per participant.
	allMatches, err := s.matchRepo.ListAllByBolao(ctx, bolaoID)
	if err != nil {
		return nil, err
	}
	matchesByRound := make(map[int][]models.Match)
	maxRound := 0
	for _, m := range allMatches {
		matchesByRound[m.Round] = append(matchesByRound[m.Round], m)
		if m.Round > maxRound {
			maxRound = m.Round
		}
	}

	// Quando "todas" as rodadas são pedidas (0 ou >= 999), usar a última rodada que existe no banco
	if upToRound <= 0 || upToRound >= 999 {
		upToRound = maxRound
	}

	participants, err := s.bolaoRepo.ListParticipants(ctx, bolaoID)
	if err != nil {
		return nil, err
	}

	allPredictions, err := s.predictionRepo.GetAllForBolao(ctx, bolaoID)
	if err != nil {
		return nil, err
	}
	predByMatchUser := make(map[uuid.UUID]map[uuid.UUID]struct{ Home, Away int })
	for _, p := range allPredictions {
		if predByMatchUser[p.MatchID] == nil {
			predByMatchUser[p.MatchID] = make(map[uuid.UUID]struct{ Home, Away int })
		}
		predByMatchUser[p.MatchID][p.UserID] = struct{ Home, Away int }{p.HomeGoals, p.AwayGoals}
	}

	userStats := make(map[uuid.UUID]*models.UserWithStats)
	for _, p := range participants {
		userStats[p.ID] = &models.UserWithStats{
			User:           p.User,
			AmountPaid:     p.AmountPaid,
			TotalPoints:    0,
			ExactScores:    0,
			CorrectResults: 0,
			RoundsWon:      0,
		}
	}

	// Round winners for tiebreaker
	roundWinners := make(map[int]uuid.UUID)

	now := time.Now()

	for round := 1; round <= upToRound; round++ {
		// Considera só jogos com resultado; jogos sem placar são ignorados.
		var matchesWithResults []matchWithResult
		for _, m := range matchesByRound[round] {
			if m.HomeGoals == nil || m.AwayGoals == nil {
				continue
			}
			matchesWithResults = append(matchesWithResults, matchWithResult{m, *m.HomeGoals, *m.AwayGoals})
		}
		if len(matchesWithResults) == 0 {
			continue
		}

		roundScores := make(map[uuid.UUID]struct {
			points         int
			exactScores    int
			correctResults int
		})

		for _, participant := range participants {
			var predList []PredEntry
			var matchList []MatchScore
			for _, mwr := range matchesWithResults {
				predHome, predAway, hasPred := 0, 0, false
				if byUser, ok := predByMatchUser[mwr.m.ID]; ok {
					if p, ok2 := byUser[participant.ID]; ok2 {
						predHome, predAway, hasPred = p.Home, p.Away, true
					}
				}
				predList = append(predList, EffectivePredEntry(mwr.m, predHome, predAway, hasPred, now))
				matchList = append(matchList, MatchScore{HomeGoals: mwr.home, AwayGoals: mwr.away})
			}

			points, exactScores, correctResults := CalculateRoundPoints(predList, matchList, true)

			userStats[participant.ID].TotalPoints += points
			userStats[participant.ID].ExactScores += exactScores
			userStats[participant.ID].CorrectResults += correctResults

			roundScores[participant.ID] = struct {
				points         int
				exactScores    int
				correctResults int
			}{points, exactScores, correctResults}
		}

		// Find round winner (max points, tiebreaker: exact scores, then correct results)
		var maxPoints int
		var winner uuid.UUID
		first := true
		for uid, rs := range roundScores {
			if rs.points == 0 {
				continue
			}
			if first || rs.points > maxPoints {
				maxPoints = rs.points
				winner = uid
				first = false
			} else if rs.points == maxPoints {
				ws := roundScores[winner]
				if rs.exactScores > ws.exactScores || (rs.exactScores == ws.exactScores && rs.correctResults > ws.correctResults) {
					winner = uid
				}
			}
		}
		if !first && maxPoints > 0 {
			roundWinners[round] = winner
			userStats[winner].RoundsWon++
		}
	}

	// Build result and sort by tiebreaker rules
	result := make([]models.UserWithStats, 0, len(userStats))
	for _, u := range userStats {
		result = append(result, *u)
	}

	sort.Slice(result, func(i, j int) bool {
		a, b := result[i], result[j]
		if a.TotalPoints != b.TotalPoints {
			return a.TotalPoints > b.TotalPoints
		}
		if a.ExactScores != b.ExactScores {
			return a.ExactScores > b.ExactScores
		}
		if a.CorrectResults != b.CorrectResults {
			return a.CorrectResults > b.CorrectResults
		}
		return a.RoundsWon > b.RoundsWon
	})

	return result, nil
}

// GetClassificationForRound returns ranking for a single round only (points in that round),
// using final match results. For cumulative classification use GetClassification.
func (s *ClassificationService) GetClassificationForRound(ctx context.Context, bolaoID uuid.UUID, round int) ([]models.UserWithStats, error) {
	matches, err := s.matchRepo.ListByRound(ctx, bolaoID, round)
	if err != nil {
		return nil, err
	}
	var matchesWithResults []matchWithResult
	for _, m := range matches {
		if m.HomeGoals == nil || m.AwayGoals == nil {
			continue
		}
		matchesWithResults = append(matchesWithResults, matchWithResult{m, *m.HomeGoals, *m.AwayGoals})
	}
	if len(matchesWithResults) == 0 {
		participants, _ := s.bolaoRepo.ListParticipants(ctx, bolaoID)
		result := make([]models.UserWithStats, 0, len(participants))
		for _, p := range participants {
			result = append(result, models.UserWithStats{
				User: p.User, AmountPaid: p.AmountPaid, TotalPoints: 0, ExactScores: 0, CorrectResults: 0, RoundsWon: 0,
			})
		}
		return result, nil
	}

	participants, err := s.bolaoRepo.ListParticipants(ctx, bolaoID)
	if err != nil {
		return nil, err
	}

	allPredictions, err := s.predictionRepo.GetAllPredictionsForRound(ctx, bolaoID, round)
	if err != nil {
		return nil, err
	}
	predByUserMatch := make(map[uuid.UUID]map[uuid.UUID]struct{ Home, Away int })
	for _, p := range allPredictions {
		if predByUserMatch[p.UserID] == nil {
			predByUserMatch[p.UserID] = make(map[uuid.UUID]struct{ Home, Away int })
		}
		predByUserMatch[p.UserID][p.MatchID] = struct{ Home, Away int }{p.HomeGoals, p.AwayGoals}
	}

	now := time.Now()

	result := make([]models.UserWithStats, 0, len(participants))
	for _, participant := range participants {
		predByMatch := predByUserMatch[participant.ID]
		var predList []PredEntry
		var matchList []MatchScore
		for _, mwr := range matchesWithResults {
			// p is the zero value when !has; EffectivePredEntry ignores it then.
			p, has := predByMatch[mwr.m.ID]
			predList = append(predList, EffectivePredEntry(mwr.m, p.Home, p.Away, has, now))
			matchList = append(matchList, MatchScore{HomeGoals: mwr.home, AwayGoals: mwr.away})
		}
		points, exactScores, correctResults := CalculateRoundPoints(predList, matchList, true)
		result = append(result, models.UserWithStats{
			User:           participant.User,
			AmountPaid:     participant.AmountPaid,
			TotalPoints:    points,
			ExactScores:    exactScores,
			CorrectResults: correctResults,
			RoundsWon:      0,
		})
	}

	sort.Slice(result, func(i, j int) bool {
		a, b := result[i], result[j]
		if a.TotalPoints != b.TotalPoints {
			return a.TotalPoints > b.TotalPoints
		}
		if a.ExactScores != b.ExactScores {
			return a.ExactScores > b.ExactScores
		}
		if a.CorrectResults != b.CorrectResults {
			return a.CorrectResults > b.CorrectResults
		}
		return false
	})
	return result, nil
}

// GetClassificationByPartials returns ranking for a single round using parciais as results.
func (s *ClassificationService) GetClassificationByPartials(ctx context.Context, bolaoID uuid.UUID, round int) ([]models.UserWithStats, error) {
	matches, err := s.matchRepo.ListByRound(ctx, bolaoID, round)
	if err != nil {
		return nil, err
	}
	partials, err := s.partialRepo.ListByRound(ctx, bolaoID, round)
	if err != nil {
		return nil, err
	}

	// Build match list with parciais - only include matches that have parciais preenchidas (não nulas).
	// Parcial 0×0 explícita conta; ausência de parcial não conta.
	// scoredMatches keeps the whole Match, not just the ID: EffectivePredEntry needs
	// MarketClosesAt.
	var matchList []MatchScore
	var scoredMatches []models.Match
	for _, m := range matches {
		if p, ok := partials[m.ID]; ok && p.HomeGoals != nil && p.AwayGoals != nil {
			matchList = append(matchList, MatchScore{HomeGoals: *p.HomeGoals, AwayGoals: *p.AwayGoals})
			scoredMatches = append(scoredMatches, m)
		}
	}
	if len(matchList) == 0 {
		return []models.UserWithStats{}, nil
	}

	participants, err := s.bolaoRepo.ListParticipants(ctx, bolaoID)
	if err != nil {
		return nil, err
	}

	allPredictions, err := s.predictionRepo.GetAllPredictionsForRound(ctx, bolaoID, round)
	if err != nil {
		return nil, err
	}
	predByUserMatch := make(map[uuid.UUID]map[uuid.UUID]struct{ Home, Away int })
	for _, p := range allPredictions {
		if predByUserMatch[p.UserID] == nil {
			predByUserMatch[p.UserID] = make(map[uuid.UUID]struct{ Home, Away int })
		}
		predByUserMatch[p.UserID][p.MatchID] = struct{ Home, Away int }{p.HomeGoals, p.AwayGoals}
	}

	now := time.Now()

	result := make([]models.UserWithStats, 0, len(participants))
	for _, participant := range participants {
		predByMatch := predByUserMatch[participant.ID]

		var predList []PredEntry
		for _, m := range scoredMatches {
			p, has := predByMatch[m.ID]
			predList = append(predList, EffectivePredEntry(m, p.Home, p.Away, has, now))
		}

		points, exactScores, correctResults := CalculateRoundPoints(predList, matchList, false)
		result = append(result, models.UserWithStats{
			User:           participant.User,
			AmountPaid:     participant.AmountPaid,
			TotalPoints:    points,
			ExactScores:    exactScores,
			CorrectResults: correctResults,
			RoundsWon:      0,
		})
	}

	sort.Slice(result, func(i, j int) bool {
		a, b := result[i], result[j]
		if a.TotalPoints != b.TotalPoints {
			return a.TotalPoints > b.TotalPoints
		}
		if a.ExactScores != b.ExactScores {
			return a.ExactScores > b.ExactScores
		}
		if a.CorrectResults != b.CorrectResults {
			return a.CorrectResults > b.CorrectResults
		}
		return false
	})
	return result, nil
}
