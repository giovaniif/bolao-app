package service

import (
	"fmt"
	"sort"
)

const (
	RuleCorrectResult    = "correct_result"
	RuleCorrectDraw      = "correct_draw"
	RuleCorrectHomeGoals = "correct_home_goals"
	RuleCorrectAwayGoals = "correct_away_goals"
	RuleExactScore       = "exact_score"
	RuleExactScoreHigh   = "exact_score_high"
	RuleTotalGoalsHigh   = "total_goals_high"
	RuleRoundTotalGoals  = "round_total_goals"
)

type Rule struct {
	Key    string `json:"key"`
	Points int    `json:"points"`
	Text   string `json:"text"`
}

type BonusTier struct {
	ScoreTypes int    `json:"score_types"`
	Points     int    `json:"points"`
	Text       string `json:"text"`
}

type RuleBook struct {
	Match                  []Rule      `json:"match"`
	Round                  []Rule      `json:"round"`
	ExactScoreVarietyBonus []BonusTier `json:"exact_score_variety_bonus"`
	Notes                  []string    `json:"notes"`
}

func Rules() RuleBook {
	tiers := make([]BonusTier, 0, len(bonusByScoreTypes))
	for types, points := range bonusByScoreTypes {
		text := fmt.Sprintf("%d placares exatos diferentes na rodada", types)
		if types == len(bonusByScoreTypes) {
			text = fmt.Sprintf("%d ou mais placares exatos diferentes na rodada", types)
		}
		tiers = append(tiers, BonusTier{ScoreTypes: types, Points: points, Text: text})
	}
	sort.Slice(tiers, func(i, j int) bool { return tiers[i].ScoreTypes < tiers[j].ScoreTypes })

	return RuleBook{
		Match: []Rule{
			{RuleCorrectResult, PointsCorrectResult, "Acertar o vencedor, ou o empate com o placar exato"},
			{RuleCorrectDraw, PointsCorrectDraw, "Acertar que vai dar empate, sem acertar o placar"},
			{RuleCorrectHomeGoals, PointsCorrectHomeGoals, "Acertar os gols do mandante"},
			{RuleCorrectAwayGoals, PointsCorrectAwayGoals, "Acertar os gols do visitante"},
			{RuleExactScore, PointsExactScore, "Placar exato em jogo com até 3 gols"},
			{RuleExactScoreHigh, PointsExactScoreHigh, "Placar exato em jogo com 4 gols ou mais (no lugar dos 3)"},
			{RuleTotalGoalsHigh, PointsTotalGoalsHigh, "Acertar o total de gols em jogo com 4 gols ou mais"},
		},
		Round: []Rule{
			{RuleRoundTotalGoals, PointsRoundTotalGoals, "Acertar o total de gols da rodada inteira"},
		},
		ExactScoreVarietyBonus: tiers,
		Notes: []string{
			"Os palpites de cada jogo fecham no horário de fechamento do mercado, que é o início do jogo nos bolões automáticos.",
			"Quem não palpitar um jogo fica com 0 x 0 nele quando o jogo começa.",
			"O bônus de gols da rodada só vale com a rodada completa.",
		},
	}
}
