package repository

func matchInBolao(param string) string {
	return `(m.bolao_id = ` + param + ` OR EXISTS (
		SELECT 1 FROM boloes bm
		WHERE bm.id = ` + param + ` AND bm.competition_id = m.competition_id AND bm.first_round IS NOT NULL AND m.round >= bm.first_round
	))`
}
