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

type roundScore struct {
	points         int
	exactScores    int
	correctResults int
}

// scoreParticipantRound scores one participant over one round. lookup reports the stored
// prediction for a match, with has=false when the participant did not submit one — which
// EffectivePredEntry turns into 0×0 if that match's market has closed.
func scoreParticipantRound(
	matches []matchWithResult,
	lookup func(matchID uuid.UUID) (home, away int, has bool),
	awardRoundTotalBonus bool,
	now time.Time,
) roundScore {
	predList := make([]PredEntry, 0, len(matches))
	matchList := make([]MatchScore, 0, len(matches))
	for _, mwr := range matches {
		home, away, has := lookup(mwr.m.ID)
		predList = append(predList, EffectivePredEntry(mwr.m, home, away, has, now))
		matchList = append(matchList, MatchScore{HomeGoals: mwr.home, AwayGoals: mwr.away})
	}
	points, exactScores, correctResults := CalculateRoundPoints(predList, matchList, awardRoundTotalBonus)
	return roundScore{points, exactScores, correctResults}
}

// pickRoundWinner returns the round winner, or ok=false when nobody scored. Players on
// zero are skipped, so a round nobody scored in has no winner.
//
// The last tiebreaker is the user ID. It is arbitrary, but Go randomizes map iteration, so
// without it a fully tied round picks a different winner on every request and RoundsWon —
// a standings tiebreaker — flaps between page loads. Players tied on every real criterion
// have to be separated by something stable.
func pickRoundWinner(scores map[uuid.UUID]roundScore) (uuid.UUID, bool) {
	var winner uuid.UUID
	var best roundScore
	found := false
	for uid, rs := range scores {
		if rs.points == 0 {
			continue
		}
		if !found || beatsRoundWinner(uid, rs, winner, best) {
			winner, best, found = uid, rs, true
		}
	}
	return winner, found
}

func beatsRoundWinner(uid uuid.UUID, rs roundScore, winner uuid.UUID, best roundScore) bool {
	if rs.points != best.points {
		return rs.points > best.points
	}
	if rs.exactScores != best.exactScores {
		return rs.exactScores > best.exactScores
	}
	if rs.correctResults != best.correctResults {
		return rs.correctResults > best.correctResults
	}
	return uid.String() < winner.String()
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

		roundScores := make(map[uuid.UUID]roundScore)

		for _, participant := range participants {
			rs := scoreParticipantRound(matchesWithResults, func(matchID uuid.UUID) (int, int, bool) {
				if byUser, ok := predByMatchUser[matchID]; ok {
					if p, ok2 := byUser[participant.ID]; ok2 {
						return p.Home, p.Away, true
					}
				}
				return 0, 0, false
			}, true, now)

			userStats[participant.ID].TotalPoints += rs.points
			userStats[participant.ID].ExactScores += rs.exactScores
			userStats[participant.ID].CorrectResults += rs.correctResults

			roundScores[participant.ID] = rs
		}

		if winner, ok := pickRoundWinner(roundScores); ok {
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
		rs := scoreParticipantRound(matchesWithResults, func(matchID uuid.UUID) (int, int, bool) {
			// p is the zero value when !has; EffectivePredEntry ignores it then.
			p, has := predByMatch[matchID]
			return p.Home, p.Away, has
		}, true, now)
		result = append(result, models.UserWithStats{
			User:           participant.User,
			AmountPaid:     participant.AmountPaid,
			TotalPoints:    rs.points,
			ExactScores:    rs.exactScores,
			CorrectResults: rs.correctResults,
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
	var scoredMatches []matchWithResult
	for _, m := range matches {
		if p, ok := partials[m.ID]; ok && p.HomeGoals != nil && p.AwayGoals != nil {
			scoredMatches = append(scoredMatches, matchWithResult{m, *p.HomeGoals, *p.AwayGoals})
		}
	}
	if len(scoredMatches) == 0 {
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

		// awardRoundTotalBonus stays false: the predictions cover the whole round while
		// the parciais only cover the matches played so far.
		rs := scoreParticipantRound(scoredMatches, func(matchID uuid.UUID) (int, int, bool) {
			p, has := predByMatch[matchID]
			return p.Home, p.Away, has
		}, false, now)

		result = append(result, models.UserWithStats{
			User:           participant.User,
			AmountPaid:     participant.AmountPaid,
			TotalPoints:    rs.points,
			ExactScores:    rs.exactScores,
			CorrectResults: rs.correctResults,
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
