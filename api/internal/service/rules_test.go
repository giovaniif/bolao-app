package service

import "testing"

func TestRules_ShowEveryScoringConstant(t *testing.T) {
	want := map[string]int{
		RuleCorrectResult:    PointsCorrectResult,
		RuleCorrectDraw:      PointsCorrectDraw,
		RuleCorrectHomeGoals: PointsCorrectHomeGoals,
		RuleCorrectAwayGoals: PointsCorrectAwayGoals,
		RuleExactScore:       PointsExactScore,
		RuleExactScoreHigh:   PointsExactScoreHigh,
		RuleTotalGoalsHigh:   PointsTotalGoalsHigh,
		RuleRoundTotalGoals:  PointsRoundTotalGoals,
	}
	rules := Rules()
	got := map[string]int{}
	for _, r := range rules.Match {
		got[r.Key] = r.Points
		if r.Text == "" {
			t.Errorf("rule %s has no text", r.Key)
		}
	}
	for _, r := range rules.Round {
		got[r.Key] = r.Points
	}
	for key, points := range want {
		if got[key] != points {
			t.Errorf("rule %s = %d points, want %d", key, got[key], points)
		}
	}
	if len(got) != len(want) {
		t.Errorf("rules = %d, want %d", len(got), len(want))
	}
}

func TestRules_ShowTheExactScoreVarietyBonus(t *testing.T) {
	bonus := Rules().ExactScoreVarietyBonus
	if len(bonus) != len(bonusByScoreTypes) {
		t.Fatalf("bonus tiers = %d, want %d", len(bonus), len(bonusByScoreTypes))
	}
	for _, tier := range bonus {
		if bonusByScoreTypes[tier.ScoreTypes] != tier.Points {
			t.Errorf("%d score types = %d points, want %d", tier.ScoreTypes, tier.Points, bonusByScoreTypes[tier.ScoreTypes])
		}
	}
	for i := 1; i < len(bonus); i++ {
		if bonus[i].ScoreTypes <= bonus[i-1].ScoreTypes {
			t.Errorf("bonus tiers are not in order: %+v", bonus)
		}
	}
}
