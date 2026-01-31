import { useState, useEffect } from 'react';
import { Layout } from '../../../shared/components/Layout';
import { formatDateTime } from '../../../shared/utils/date';
import { useRounds, useMatchesByRound } from '../../matches/hooks/useMatches';
import { useMyPredictions, useSavePredictions } from '../hooks/usePredictions';
import type { Match } from '../../matches/api/matchesApi';

export function PredictionsPage() {
  const [round, setRound] = useState<number>(0);
  const [predictions, setPredictions] = useState<Record<string, { h: number; a: number }>>({});
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const { data: rounds = [] } = useRounds();
  const { data: matches = [], isLoading } = useMatchesByRound(round);
  const { data: myPredictions = [] } = useMyPredictions(round);
  const savePredictionsMutation = useSavePredictions(round);

  useEffect(() => {
    if (rounds.length > 0 && (round === 0 || !rounds.includes(round))) {
      setRound(rounds[0]);
    }
  }, [rounds, round]);

  useEffect(() => {
    const map: Record<string, { h: number; a: number }> = {};
    for (const pred of myPredictions) {
      map[pred.match_id] = { h: pred.home_goals, a: pred.away_goals };
    }
    for (const match of matches) {
      if (!map[match.id]) {
        map[match.id] = { h: 0, a: 0 };
      }
    }
    setPredictions(map);
  }, [matches, myPredictions]);

  function handleChange(matchId: string, home: number, away: number) {
    setPredictions((prev) => ({
      ...prev,
      [matchId]: { h: home, a: away },
    }));
  }

  function isClosed(m: Match): boolean {
    if (!m.market_closes_at) return false;
    return new Date(m.market_closes_at) < new Date();
  }

  async function handleSave() {
    setMessage(null);
    try {
      const payload = Object.entries(predictions).map(([matchId, v]) => ({
        match_id: matchId,
        home_goals: v.h,
        away_goals: v.a,
      }));
      await savePredictionsMutation.mutateAsync(payload);
      setMessage({ type: 'ok', text: 'Palpites salvos!' });
    } catch (err) {
      setMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erro ao salvar',
      });
    }
  }

  return (
    <Layout title="Palpites">
      <div className="space-y-4">
        {rounds.length > 0 && (
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">
              Rodada
            </label>
            <select
              value={round}
              onChange={(e) => setRound(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-card)] border border-slate-600 text-white"
            >
              {rounds.map((r) => (
                <option key={r} value={r}>
                  Rodada {r}
                </option>
              ))}
            </select>
          </div>
        )}

        {message && (
          <p
            className={`text-sm text-center py-2 ${
              message.type === 'ok' ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {message.text}
          </p>
        )}

        {isLoading ? (
          <p className="text-center py-8 text-[var(--color-text-muted)]">
            Carregando...
          </p>
        ) : (
          <>
            <div className="space-y-3">
              {matches.map((m) => {
                const closed = isClosed(m);
                const pred = predictions[m.id] ?? { h: 0, a: 0 };
                return (
                  <div
                    key={m.id}
                    className="p-4 rounded-lg bg-[var(--color-card)] border border-slate-700"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-sm text-[var(--color-text-muted)]">
                        {m.market_closes_at &&
                          `Fecha: ${formatDateTime(m.market_closes_at)}`}
                        {closed && (
                          <span className="ml-2 text-amber-400">(fechado)</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="flex-1 text-right truncate">
                        {m.home_team}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          min={0}
                          max={99}
                          value={pred.h}
                          onChange={(e) =>
                            handleChange(
                              m.id,
                              parseInt(e.target.value) || 0,
                              pred.a
                            )
                          }
                          disabled={closed}
                          className="w-12 py-1 text-center rounded bg-slate-800 border border-slate-600 text-white disabled:opacity-50"
                        />
                        <span className="text-[var(--color-text-muted)]">x</span>
                        <input
                          type="number"
                          min={0}
                          max={99}
                          value={pred.a}
                          onChange={(e) =>
                            handleChange(
                              m.id,
                              pred.h,
                              parseInt(e.target.value) || 0
                            )
                          }
                          disabled={closed}
                          className="w-12 py-1 text-center rounded bg-slate-800 border border-slate-600 text-white disabled:opacity-50"
                        />
                      </div>
                      <span className="flex-1 truncate">{m.away_team}</span>
                    </div>
                    {m.home_goals != null && m.away_goals != null && (
                      <p className="text-xs text-[var(--color-text-muted)] text-center mt-1">
                        Resultado: {m.home_goals} x {m.away_goals}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {matches.length > 0 && (
              <button
                onClick={handleSave}
                disabled={savePredictionsMutation.isPending}
                className="w-full py-3 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-medium disabled:opacity-50"
              >
                {savePredictionsMutation.isPending ? 'Salvando...' : 'Salvar palpites'}
              </button>
            )}

            {matches.length === 0 && !isLoading && (
              <p className="text-center py-8 text-[var(--color-text-muted)]">
                Nenhum jogo nesta rodada
              </p>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
