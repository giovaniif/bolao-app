package service

import "fmt"

// Scoring implements the rules from criterios.md
const (
	PointsCorrectResult    = 9  // Indicação correta do time vencedor
	PointsCorrectDraw      = 12 // Indicação de empate sem acerto do placar
	PointsCorrectHomeGoals = 3  // Acerto gols time mandante
	PointsCorrectAwayGoals = 3  // Acerto gols time visitante
	PointsExactScore       = 3  // Acerto do placar (jogos normais)
	PointsExactScoreHigh   = 10 // Acerto placar em jogos com 4+ gols
	PointsTotalGoalsHigh   = 3  // Acerto número de gols em jogos com 4+ gols
	PointsRoundTotalGoals  = 10 // Acerto número de gols da rodada
)

// Bonus por quantidade diferente de placares acertados (tipos de resultado)
// 1 tipo=0, 2 tipos=10, 3 tipos=20, 4+=30
var bonusByScoreTypes = map[int]int{
	1: 0,
	2: 10,
	3: 20,
	4: 30,
}

func CalculateMatchPoints(predHome, predAway, realHome, realAway int) int {
	points := 0

	// Correct result: 9 pts (winner) ou 12 pts (empate sem acerto do placar)
	predResult := matchResult(predHome, predAway)
	realResult := matchResult(realHome, realAway)
	if predResult == realResult {
		exactScore := predHome == realHome && predAway == realAway
		if realResult == "draw" && !exactScore {
			points += PointsCorrectDraw // 12: empate sem acertar o placar
		} else {
			points += PointsCorrectResult // 9: vencedor ou empate exato
		}
	}

	// Correct home goals: 3 points
	if predHome == realHome {
		points += PointsCorrectHomeGoals
	}

	// Correct away goals: 3 points
	if predAway == realAway {
		points += PointsCorrectAwayGoals
	}

	// Exact score bonus
	realTotal := realHome + realAway
	if predHome == realHome && predAway == realAway {
		if realTotal >= 4 {
			points += PointsExactScoreHigh // 10 em jogos com 4+ gols
		} else {
			points += PointsExactScore // 3 em jogos normais
		}
	}

	// For games with 4+ goals: acerto do total de gols
	if realTotal >= 4 {
		predTotal := predHome + predAway
		if predTotal == realTotal {
			points += PointsTotalGoalsHigh
		}
	}

	return points
}

func matchResult(home, away int) string {
	if home > away {
		return "home"
	}
	if away > home {
		return "away"
	}
	return "draw"
}

func CalculateRoundPoints(predictions []struct {
	PredHome, PredAway int
}, matches []struct {
	HomeGoals, AwayGoals int
}, roundTotalGoals int) (int, int, int) {
	totalPoints := 0
	exactScores := 0
	correctResults := 0

	// Build prediction map by match index
	predMap := make(map[int]struct{ PredHome, PredAway int })
	for i, p := range predictions {
		predMap[i] = p
	}

	// Track exact score types for bonus
	exactScoreTypes := make(map[string]bool)
	roundPredTotal := 0

	for i, m := range matches {
		p := predMap[i]
		roundPredTotal += p.PredHome + p.PredAway

		pts := CalculateMatchPoints(p.PredHome, p.PredAway, m.HomeGoals, m.AwayGoals)
		totalPoints += pts

		if p.PredHome == m.HomeGoals && p.PredAway == m.AwayGoals {
			exactScores++
			exactScoreTypes[scoreKey(m.HomeGoals, m.AwayGoals)] = true
		}

		if matchResult(p.PredHome, p.PredAway) == matchResult(m.HomeGoals, m.AwayGoals) {
			correctResults++
		}
	}

	// Round total goals: 10 points
	actualRoundTotal := 0
	for _, m := range matches {
		actualRoundTotal += m.HomeGoals + m.AwayGoals
	}
	if roundPredTotal == actualRoundTotal {
		totalPoints += PointsRoundTotalGoals
	}

	// Bonus by different exact score types
	scoreTypes := len(exactScoreTypes)
	if scoreTypes >= 4 {
		scoreTypes = 4
	}
	if bonus, ok := bonusByScoreTypes[scoreTypes]; ok {
		totalPoints += bonus
	}

	return totalPoints, exactScores, correctResults
}

func scoreKey(home, away int) string {
	return fmt.Sprintf("%d-%d", home, away)
}
