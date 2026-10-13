package service

import "fmt"

const (
	PointsCorrectResult    = 9
	PointsCorrectDraw      = 12
	PointsCorrectHomeGoals = 3
	PointsCorrectAwayGoals = 3
	PointsExactScore       = 3
	PointsExactScoreHigh   = 10
	PointsTotalGoalsHigh   = 3
	PointsRoundTotalGoals  = 10
)

var bonusByScoreTypes = map[int]int{
	1: 0,
	2: 10,
	3: 20,
	4: 30,
}

func CalculateMatchPoints(predHome, predAway, realHome, realAway int) int {
	points := 0

	predResult := matchResult(predHome, predAway)
	realResult := matchResult(realHome, realAway)
	if predResult == realResult {
		exactScore := predHome == realHome && predAway == realAway
		if realResult == "draw" && !exactScore {
			points += PointsCorrectDraw
		} else {
			points += PointsCorrectResult
		}
	}

	if predHome == realHome {
		points += PointsCorrectHomeGoals
	}

	if predAway == realAway {
		points += PointsCorrectAwayGoals
	}

	realTotal := realHome + realAway
	if predHome == realHome && predAway == realAway {
		if realTotal >= 4 {
			points += PointsExactScoreHigh
		} else {
			points += PointsExactScore
		}
	}

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

func CalculateRoundPoints(predictions []PredEntry, matches []MatchScore, awardRoundTotalBonus bool) (int, int, int) {
	totalPoints := 0
	exactScores := 0
	correctResults := 0

	predMap := make(map[int]PredEntry)
	for i, p := range predictions {
		predMap[i] = p
	}

	exactScoreTypes := make(map[string]bool)
	roundPredTotal := 0
	counted := 0

	for i, m := range matches {
		p := predMap[i]
		if p.PredHome < 0 || p.PredAway < 0 {
			continue
		}
		counted++
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

	actualRoundTotal := 0
	for _, m := range matches {
		actualRoundTotal += m.HomeGoals + m.AwayGoals
	}
	if awardRoundTotalBonus && counted > 0 && roundPredTotal == actualRoundTotal {
		totalPoints += PointsRoundTotalGoals
	}

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
