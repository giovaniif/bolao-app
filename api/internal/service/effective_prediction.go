package service

import (
	"time"

	"github.com/bolao-app/api/internal/models"
	"github.com/google/uuid"
)

// PredEntry e MatchScore são type ALIASES (=), não tipos definidos: []PredEntry é o
// mesmo tipo que o struct anônimo que CalculateRoundPoints já recebe, então dar nome
// a eles não muda nenhuma assinatura.
type PredEntry = struct{ PredHome, PredAway int }
type MatchScore = struct{ HomeGoals, AwayGoals int }

// noPredSentinel: palpite ausente com o mercado ainda aberto. CalculateRoundPoints ignora.
const noPredSentinel = -1

// MarketClosed diz se o mercado do jogo já fechou em `now`.
//
// MarketClosesAt nulo significa que nenhuma data de fechamento foi definida, ou seja,
// mercado ABERTO — o mesmo critério que o caminho de escrita usa em
// PredictionHandler.UpsertPredictions. Ler e escrever precisam concordar: se a leitura
// tratasse nulo como fechado, o jogador levaria 0×0 num jogo em que ainda pode palpitar.
func MarketClosed(m models.Match, now time.Time) bool {
	return m.MarketClosesAt != nil && now.After(*m.MarketClosesAt)
}

// EffectivePrediction aplica a regra do ausente: quem não palpitou num jogo cujo mercado
// já fechou é tratado como tendo palpitado 0×0.
//
// counts == false significa que o jogo deve ser ignorado por completo (não pontua, não
// aparece) — palpite ausente e mercado ainda aberto.
func EffectivePrediction(m models.Match, predHome, predAway int, hasPred bool, now time.Time) (home, away int, counts bool) {
	if hasPred {
		return predHome, predAway, true
	}
	if MarketClosed(m, now) {
		return 0, 0, true
	}
	return 0, 0, false
}

// EffectivePredEntry é a forma de EffectivePrediction no formato que CalculateRoundPoints
// consome, devolvendo a sentinela quando o jogo não conta.
func EffectivePredEntry(m models.Match, predHome, predAway int, hasPred bool, now time.Time) PredEntry {
	h, a, counts := EffectivePrediction(m, predHome, predAway, hasPred, now)
	if !counts {
		return PredEntry{PredHome: noPredSentinel, PredAway: noPredSentinel}
	}
	return PredEntry{PredHome: h, PredAway: a}
}

// FillMissingPredictions devolve, na ordem de `matches`, o palpite salvo quando existe ou
// um 0×0 sintetizado (ID uuid.Nil, timestamps zerados, AutoFilled=true) quando o mercado
// já fechou. Jogos com mercado aberto e sem palpite ficam de fora.
func FillMissingPredictions(matches []models.Match, userID uuid.UUID, existing []models.Prediction, now time.Time) []models.Prediction {
	byMatch := make(map[uuid.UUID]models.Prediction, len(existing))
	for _, p := range existing {
		byMatch[p.MatchID] = p
	}

	out := make([]models.Prediction, 0, len(matches))
	for _, m := range matches {
		if p, ok := byMatch[m.ID]; ok {
			out = append(out, p)
			continue
		}
		if !MarketClosed(m, now) {
			continue
		}
		out = append(out, models.Prediction{
			UserID:     userID,
			MatchID:    m.ID,
			HomeGoals:  0,
			AwayGoals:  0,
			AutoFilled: true,
		})
	}
	return out
}
