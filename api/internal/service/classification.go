package service

import (
	"context"
	"sort"

	"github.com/bolao-app/api/internal/models"
	"github.com/bolao-app/api/internal/repository"
	"github.com/google/uuid"
)

type ClassificationService struct {
	userRepo       *repository.UserRepository
	matchRepo      *repository.MatchRepository
	predictionRepo *repository.PredictionRepository
	partialRepo    *repository.PartialRepository
}

func NewClassificationService(
	userRepo *repository.UserRepository,
	matchRepo *repository.MatchRepository,
	predictionRepo *repository.PredictionRepository,
	partialRepo *repository.PartialRepository,
) *ClassificationService {
	return &ClassificationService{
		userRepo:       userRepo,
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

func (s *ClassificationService) GetClassification(ctx context.Context, upToRound int) ([]models.UserWithStats, error) {
	// Quando "todas" as rodadas são pedidas (0 ou >= 999), usar a última rodada que existe no banco
	if upToRound <= 0 || upToRound >= 999 {
		rounds, err := s.matchRepo.ListRounds(ctx)
		if err != nil {
			return nil, err
		}
		if len(rounds) == 0 {
			upToRound = 0
		} else {
			upToRound = rounds[len(rounds)-1]
		}
	}

	users, err := s.userRepo.List(ctx)
	if err != nil {
		return nil, err
	}

	userStats := make(map[uuid.UUID]*models.UserWithStats)
	for _, u := range users {
		userStats[u.ID] = &models.UserWithStats{
			User:           u,
			TotalPoints:    0,
			ExactScores:    0,
			CorrectResults: 0,
			RoundsWon:      0,
		}
	}

	// Round winners for tiebreaker
	roundWinners := make(map[int]uuid.UUID)

	for round := 1; round <= upToRound; round++ {
		matches, err := s.matchRepo.ListByRound(ctx, round)
		if err != nil {
			return nil, err
		}

		// Considera só jogos com resultado; jogos sem placar são ignorados.
		var matchesWithResults []struct {
			m     models.Match
			home  int
			away  int
		}
		for _, m := range matches {
			if m.HomeGoals == nil || m.AwayGoals == nil {
				continue
			}
			matchesWithResults = append(matchesWithResults, struct {
				m     models.Match
				home  int
				away  int
			}{m, *m.HomeGoals, *m.AwayGoals})
		}
		if len(matchesWithResults) == 0 {
			continue
		}

		roundScores := make(map[uuid.UUID]struct {
			points         int
			exactScores    int
			correctResults int
		})

		for _, user := range users {
			predictions, err := s.predictionRepo.GetByUserAndRound(ctx, user.ID, round)
			if err != nil {
				return nil, err
			}

			// Build prediction map by match ID
			predByMatch := make(map[uuid.UUID]struct{ Home, Away int })
			for _, p := range predictions {
				predByMatch[p.MatchID] = struct{ Home, Away int }{p.HomeGoals, p.AwayGoals}
			}

			var predList []struct{ PredHome, PredAway int }
			var matchList []struct{ HomeGoals, AwayGoals int }

			for _, mwr := range matchesWithResults {
				m := mwr.m
				p := predByMatch[m.ID]
				predList = append(predList, struct{ PredHome, PredAway int }{p.Home, p.Away})
				matchList = append(matchList, struct{ HomeGoals, AwayGoals int }{mwr.home, mwr.away})
			}

			points, exactScores, correctResults := CalculateRoundPoints(predList, matchList, 0)

			userStats[user.ID].TotalPoints += points
			userStats[user.ID].ExactScores += exactScores
			userStats[user.ID].CorrectResults += correctResults

			roundScores[user.ID] = struct {
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
func (s *ClassificationService) GetClassificationForRound(ctx context.Context, round int) ([]models.UserWithStats, error) {
	matches, err := s.matchRepo.ListByRound(ctx, round)
	if err != nil {
		return nil, err
	}
	var matchesWithResults []struct {
		m     models.Match
		home  int
		away  int
	}
	for _, m := range matches {
		if m.HomeGoals == nil || m.AwayGoals == nil {
			continue
		}
		matchesWithResults = append(matchesWithResults, struct {
			m     models.Match
			home  int
			away  int
		}{m, *m.HomeGoals, *m.AwayGoals})
	}
	if len(matchesWithResults) == 0 {
		users, _ := s.userRepo.List(ctx)
		result := make([]models.UserWithStats, 0, len(users))
		for _, u := range users {
			result = append(result, models.UserWithStats{
				User: u, TotalPoints: 0, ExactScores: 0, CorrectResults: 0, RoundsWon: 0,
			})
		}
		return result, nil
	}

	users, err := s.userRepo.List(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]models.UserWithStats, 0, len(users))
	for _, user := range users {
		predictions, err := s.predictionRepo.GetByUserAndRound(ctx, user.ID, round)
		if err != nil {
			return nil, err
		}
		predByMatch := make(map[uuid.UUID]struct{ Home, Away int })
		for _, p := range predictions {
			predByMatch[p.MatchID] = struct{ Home, Away int }{p.HomeGoals, p.AwayGoals}
		}
		var predList []struct{ PredHome, PredAway int }
		var matchList []struct{ HomeGoals, AwayGoals int }
		for _, mwr := range matchesWithResults {
			m := mwr.m
			p := predByMatch[m.ID]
			predList = append(predList, struct{ PredHome, PredAway int }{p.Home, p.Away})
			matchList = append(matchList, struct{ HomeGoals, AwayGoals int }{mwr.home, mwr.away})
		}
		points, exactScores, correctResults := CalculateRoundPoints(predList, matchList, 0)
		result = append(result, models.UserWithStats{
			User:           user,
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
func (s *ClassificationService) GetClassificationByPartials(ctx context.Context, round int) ([]models.UserWithStats, error) {
	matches, err := s.matchRepo.ListByRound(ctx, round)
	if err != nil {
		return nil, err
	}
	partials, err := s.partialRepo.ListByRound(ctx, round)
	if err != nil {
		return nil, err
	}

	// Build match list with parciais - only include matches that have parciais preenchidas (não nulas).
	// Parcial 0×0 explícita conta; ausência de parcial não conta.
	var matchList []struct{ HomeGoals, AwayGoals int }
	var matchIDs []uuid.UUID
	for _, m := range matches {
		if p, ok := partials[m.ID]; ok && p.HomeGoals != nil && p.AwayGoals != nil {
			matchList = append(matchList, struct{ HomeGoals, AwayGoals int }{*p.HomeGoals, *p.AwayGoals})
			matchIDs = append(matchIDs, m.ID)
		}
	}
	if len(matchList) == 0 {
		return []models.UserWithStats{}, nil
	}

	users, err := s.userRepo.List(ctx)
	if err != nil {
		return nil, err
	}

	// Build match ID to index map for predictions
	matchIdx := make(map[uuid.UUID]int)
	for i, id := range matchIDs {
		matchIdx[id] = i
	}

	result := make([]models.UserWithStats, 0, len(users))
	for _, user := range users {
		predictions, err := s.predictionRepo.GetByUserAndRound(ctx, user.ID, round)
		if err != nil {
			return nil, err
		}
		predByMatch := make(map[uuid.UUID]struct{ Home, Away int })
		for _, p := range predictions {
			predByMatch[p.MatchID] = struct{ Home, Away int }{p.HomeGoals, p.AwayGoals}
		}

		var predList []struct{ PredHome, PredAway int }
		for _, id := range matchIDs {
			p := predByMatch[id]
			predList = append(predList, struct{ PredHome, PredAway int }{p.Home, p.Away})
		}

		points, exactScores, correctResults := CalculateRoundPoints(predList, matchList, 0)
		result = append(result, models.UserWithStats{
			User:           user,
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
