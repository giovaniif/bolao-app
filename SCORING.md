# Bolão scoring rules

> This document is the scoring specification. If a rule changes, `scoring.go`,
> `scoring_test.go`, and this file change together, in the same PR. If the code and this
> document ever say different things, that is a bug — not a matter of picking which one to
> trust.

## 1. Rule-to-constant table

Every scoring rule below has a matching constant in `api/internal/service/scoring.go`. Use
this table to keep the two halves (document and code) from drifting apart silently.

| Rule | Constant | Value | File |
|---|---|---|---|
| Correctly predicting the winning team, or a draw with the exact score | `PointsCorrectResult` | 9 | `scoring.go` |
| Correctly predicting a draw, but without the exact score | `PointsCorrectDraw` | 12 | `scoring.go` |
| Correctly predicting the home team's goal count | `PointsCorrectHomeGoals` | 3 | `scoring.go` |
| Correctly predicting the away team's goal count | `PointsCorrectAwayGoals` | 3 | `scoring.go` |
| Exact score (game with fewer than 4 total goals) | `PointsExactScore` | 3 | `scoring.go` |
| Exact score in a game with 4 or more total goals | `PointsExactScoreHigh` | 10 | `scoring.go` |
| Correct total goals (home + away) in a game with 4+ goals, even without the exact score | `PointsTotalGoalsHigh` | 3 | `scoring.go` |
| Correct total goal count for the entire round | `PointsRoundTotalGoals` | 10 | `scoring.go` |
| Bonus for variety of exact scores predicted in the round | `bonusByScoreTypes` | 1 type=0 / 2=10 / 3=20 / 4+=30 | `scoring.go` |

The two functions that apply these constants are `CalculateMatchPoints` (one match) and
`CalculateRoundPoints` (an entire round, including the bonuses that only make sense at the
aggregate level).

## 2. Scoring a single match

### 2.1 Result: 9 points vs. 12 points

This is the part that's easiest to mix up. Both rules use the same match condition ("the
predicted result matches the real result") but pay different amounts depending on the type
of result:

- **9 points** (`PointsCorrectResult`) — the prediction got the **winner** right (home or
  away), OR got a **draw with the exact score** (e.g., predicted 1×1, result 1×1).
- **12 points** (`PointsCorrectDraw`) — the prediction called a **draw and the game ended in
  a draw**, but the exact score didn't match (e.g., predicted 0×0, result 2×2). Getting the
  "category" of the result right (a draw) without the exact score is worth more than getting
  an exact draw or a winner right, because the exact score on top of a draw already earns
  points through a separate rule (see §2.3).

In code (`CalculateMatchPoints`):

```go
if predResult == realResult {
    exactScore := predHome == realHome && predAway == realAway
    if realResult == "draw" && !exactScore {
        points += PointsCorrectDraw // 12: draw without the exact score
    } else {
        points += PointsCorrectResult // 9: winner or exact draw
    }
}
```

### 2.2 Home and away goals

Regardless of whether the result is correct, each goal count predicted correctly on its own
is worth 3 points:

- `PointsCorrectHomeGoals` (3 pts) — the home team's predicted goal count matches the real
  one.
- `PointsCorrectAwayGoals` (3 pts) — the away team's predicted goal count matches the real
  one.

These two checks are independent of each other and independent of the result rule: a player
can earn just one, both, neither, or both together with the result bonus.

### 2.3 Exact score

When the prediction gets the exact score right (home and away at the same time), an
additional bonus is added, whose value depends on the game's total goal count:

- **Game with up to 3 total goals** (home + away < 4): `PointsExactScore` = 3 points.
- **Game with 4 or more total goals**: `PointsExactScoreHigh` = 10 points, in place of the 3.

### 2.4 Games with 4 or more goals: how the bonuses stack

High-scoring games (4+ real goals) have a second layer of bonus, `PointsTotalGoalsHigh` (3
points), which pays for correctly predicting the game's **total goal count** (home + away
combined), whether or not the exact score is also correct. This bonus is added *on top of*
`PointsExactScoreHigh` — it does not replace it:

```go
// Bonus in games with 4+ goals.
// Exact score: +10 (already added above). Correct total goals (with or without exact score): +3.
```

In other words, when the score is exact **and** the game has 4+ goals, a single match can add
up to:

| Component | Constant | Points |
|---|---|---|
| Result (winner or exact draw) | `PointsCorrectResult` | 9 |
| Home goals | `PointsCorrectHomeGoals` | 3 |
| Away goals | `PointsCorrectAwayGoals` | 3 |
| Exact score in a 4+ goal game | `PointsExactScoreHigh` | 10 |
| Total game goals (4+ goals) | `PointsTotalGoalsHigh` | 3 |
| **Total** | | **28** |

(see the step-by-step example in §6.1, and the test case `{3, 3, 3, 3, 28}` in
`scoring_test.go`).

## 3. Round bonuses

`CalculateRoundPoints` sums the points from each match (via `CalculateMatchPoints`) and adds
two bonuses that only exist at the round level.

### 3.1 Round total goals — complete rounds only

`PointsRoundTotalGoals` (10 points) is awarded when the sum of all the goal predictions in
the round (home + away for every match) matches the real sum of goals across every match in
the round.

This bonus only applies when the round is **complete** (`awardRoundTotalBonus = true`), never
for partial rounds. The reason: the goals prediction covers the whole round (every match),
but partials only have results for the matches already played at that point — comparing the
predicted total (whole round) against a partial real total (only some matches) is
meaningless, and would arbitrarily penalize or reward the player. That's why
`GetClassificationByPartials` (in `classification.go`) calls `CalculateRoundPoints` with
`awardRoundTotalBonus = false`.

There's also a guard against a degenerate case: if **no** prediction in the round counts
(`counted == 0` — every match still has an open market and no prediction), the predicted
total ends up at zero "by vacuity" and would match a real round of 0×0 across the board,
rewarding a player who predicted nothing. The `counted > 0` condition exists purely for that.

### 3.2 Bonus for variety of exact scores

Every real score that the player predicts exactly counts as one "type" (key `"H-A"`, e.g.
`"1-0"`). The bonus depends on **how many distinct types** of exact score the player racked
up in the round — not how many matches they got right (predicting the same score twice, e.g.
1×0 in two different matches, counts as 1 type, not 2):

| Distinct exact-score types | Bonus |
|---|---|
| 1 | 0 |
| 2 | 10 |
| 3 | 20 |
| 4 or more | 30 |

## 4. Missing prediction (no-show)

Rule implemented in `api/internal/service/effective_prediction.go`:

- **Market still open and no prediction registered** → the match is **ignored entirely** for
  that player: it doesn't add points, doesn't count as a correct result, doesn't count as an
  exact score, and doesn't enter the round's predicted goal total (`EffectivePrediction`
  returns `counts = false`; internally this becomes the `noPredSentinel = -1` sentinel, which
  `CalculateRoundPoints` skips with `continue`).
- **Market closed and no prediction registered** → the prediction automatically becomes
  **0×0** (`EffectivePrediction` returns `home=0, away=0, counts=true`). That 0×0 goes into
  `CalculateMatchPoints` normally, like any other prediction: it can score points (for
  example, 18 points if the real game also ends 0×0), and the score "0-0" counts as a type
  for the variety bonus (§3.2).
- A null `MarketClosesAt` (a match with no closing date set) is treated as an **open**
  market — the player can still bet, so it never turns into 0×0 just for lacking a date.

## 5. Tiebreaker criteria

Rules implemented in `api/internal/service/classification.go`, applied after the points for
each match/round have already been summed by the rules above.

**Overall standings (cumulative, `GetClassification`)** — in case of a tie, criteria in
order:

1. Highest total points.
2. Highest number of exact scores.
3. Highest number of correct results (winner/draw predicted, exact or not).
4. Highest number of rounds won (`RoundsWon`).

**Standings for a single round (`GetClassificationForRound`,
`GetClassificationByPartials`)** — same order, without the rounds-won criterion (it doesn't
apply to a single round):

1. Highest total points in the round.
2. Highest number of exact scores in the round.
3. Highest number of correct results in the round.

**Round winner (`pickRoundWinner`, used to count `RoundsWon`)** — the same first three
scoring criteria; the final tiebreaker is the user's UUID (arbitrary, but stable) — just to
guarantee that a total tie doesn't change winner on every request, since map iteration order
in Go isn't deterministic.

## 6. Worked examples

### 6.1 A single match — exact score in a 4+ goal game

Prediction: 3×3. Real result: 3×3 (`CalculateMatchPoints(3, 3, 3, 3)`, a test case in
`scoring_test.go`).

| Step | Rule | Points | Running total |
|---|---|---|---|
| 1 | Result: exact draw → `PointsCorrectResult` | +9 | 9 |
| 2 | Home goals correct (3=3) → `PointsCorrectHomeGoals` | +3 | 12 |
| 3 | Away goals correct (3=3) → `PointsCorrectAwayGoals` | +3 | 15 |
| 4 | Exact score, real total = 6 (≥4) → `PointsExactScoreHigh` | +10 | 25 |
| 5 | Game's total goals correct (6=6), 4+ goal game → `PointsTotalGoalsHigh` | +3 | 28 |

**Total: 28 points.**

### 6.2 A draw with the wrong score, to contrast 9 vs. 12

Prediction: 0×0. Real result: 1×1 (`CalculateMatchPoints(0, 0, 1, 1)`).

- Result: both are draws, but the score doesn't match → `PointsCorrectDraw` = **12 points**.
- Home goals (0 ≠ 1): no points. Away goals (0 ≠ 1): no points. No exact score, no 4+ goal
  bonus (real total = 2).

**Total: 12 points** — more than the 9 points for a correctly predicted winner or an exact
draw, because here there's no other bonus stacked on top.

### 6.3 A complete round

Based on `TestCalculateRoundPoints` (`scoring_test.go`), 5 matches, complete round
(`awardRoundTotalBonus = true`):

| # | Prediction | Real | Match points | Detail |
|---|---|---|---|---|
| 1 | 1×0 | 1×0 | 18 | exact: 9+3+3+3 |
| 2 | 0×1 | 0×1 | 18 | exact: 9+3+3+3 |
| 3 | 2×1 | 1×0 | 9 | result only (home win) |
| 4 | 1×0 | 1×2 | 3 | home goals only |
| 5 | 1×1 | 2×1 | 3 | away goals only |

Sum of matches: 18+18+9+3+3 = **51**.

Exact-score variety bonus: 2 distinct types predicted (`"1-0"` and `"0-1"`) → +10 (table in
§3.2).

Round total goals bonus: predicted sum = 1+1+3+1+2 = 8; real sum = 1+1+1+3+3 = 9. They don't
match → **no `PointsRoundTotalGoals` bonus.**

**Round total: 51 + 10 = 61 points.**

## 7. Changes from the older printed rules

An earlier printed version of these rules circulated among players with a few numbers that
no longer match what the app does today. If your memory of the rules differs from this
document, it's likely one of these:

- **A draw without the exact score pays 12 points, not 9.** Getting the draw right without
  matching the score (`PointsCorrectDraw`) is worth more than a correctly predicted winner or
  an exact draw (`PointsCorrectResult` = 9) — see §2.1 for why.
- **The exact-score bonus for games with fewer than 4 total goals is 3 points**
  (`PointsExactScore`). Only the 4+ goal case (10 points) tends to get remembered, but the
  sub-4-goal case is a rule in its own right — see §2.3.
- **The round-total-goals bonus (`PointsRoundTotalGoals`, 10 points) only applies to complete
  rounds.** It's never awarded on partials — see §3.1 for why. Partial standings were added
  to the app after the original rules were written, so this distinction didn't exist yet at
  the time.
- **The final standings use exactly three tiebreakers**: exact scores, then correct results,
  then rounds won (§5). That's the complete list — there is no additional criterion beyond
  these three.
