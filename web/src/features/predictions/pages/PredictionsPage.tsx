import { useState, useEffect } from 'react';
import { Layout } from '../../../shared/components/Layout';
import { useRounds, useMatchesByRound } from '../../matches/hooks/useMatches';
import { useMyPredictions, useSavePredictions } from '../hooks/usePredictions';
import { PredictionsTinderCard } from '../components/PredictionsTinderCard';
import { PredictionsSummaryList } from '../components/PredictionsSummaryList';
import type { Match } from '../../matches/api/matchesApi';

type ViewMode = 'tinder' | 'list';

export function PredictionsPage() {
  const [round, setRound] = useState<number>(0);
  const [predictions, setPredictions] = useState<Record<string, { h: number; a: number }>>({});
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('tinder');

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

  useEffect(() => {
    setCurrentCardIndex(0);
    setViewMode('tinder');
  }, [round]);

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
      setViewMode('list');
    } catch (err) {
      setMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erro ao salvar',
      });
    }
  }

  const currentMatch = matches[currentCardIndex];
  const allClosed = matches.length > 0 && matches.every(isClosed);

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
        ) : matches.length === 0 ? (
          <p className="text-center py-8 text-[var(--color-text-muted)]">
            Nenhum jogo nesta rodada
          </p>
        ) : viewMode === 'list' ? (
          <>
            <PredictionsSummaryList
              matches={matches}
              predictions={predictions}
              onEdit={() => setViewMode('tinder')}
              isClosed={isClosed}
            />
            <button
              onClick={() => setViewMode('tinder')}
              className="w-full py-3 rounded-lg border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 font-medium"
            >
              Editar palpites
            </button>
          </>
        ) : (
          <>
            <PredictionsTinderCard
              match={currentMatch}
              homeGoals={predictions[currentMatch.id]?.h ?? 0}
              awayGoals={predictions[currentMatch.id]?.a ?? 0}
              onGoalsChange={(h, a) => handleChange(currentMatch.id, h, a)}
              onSwipeLeft={() =>
                setCurrentCardIndex((i) => Math.min(i + 1, matches.length - 1))
              }
              onSwipeRight={() =>
                setCurrentCardIndex((i) => Math.max(i - 1, 0))
              }
              hasNext={currentCardIndex < matches.length - 1}
              hasPrev={currentCardIndex > 0}
              currentIndex={currentCardIndex}
              total={matches.length}
              disabled={isClosed(currentMatch)}
            />

            {/* Resumo compacto abaixo do card */}
            <details className="rounded-lg bg-[var(--color-card)] border border-slate-700">
              <summary className="px-4 py-3 cursor-pointer text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
                Ver resumo dos jogos
              </summary>
              <div className="px-4 pb-4 space-y-2">
                {matches.map((m, i) => {
                  const pred = predictions[m.id] ?? { h: 0, a: 0 };
                  return (
                    <div
                      key={m.id}
                      onClick={() => setCurrentCardIndex(i)}
                      className={`flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer transition-colors ${
                        i === currentCardIndex
                          ? 'bg-[var(--color-primary)]/20'
                          : 'hover:bg-slate-700/50'
                      }`}
                    >
                      <span className="text-sm truncate flex-1">
                        {m.home_team} × {m.away_team}
                      </span>
                      <span className="text-sm shrink-0 ml-2">
                        {pred.h}×{pred.a}
                      </span>
                    </div>
                  );
                })}
              </div>
            </details>

            <button
              onClick={handleSave}
              disabled={savePredictionsMutation.isPending || allClosed}
              className="w-full py-3 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-medium disabled:opacity-50"
            >
              {savePredictionsMutation.isPending ? 'Salvando...' : 'Salvar palpites'}
            </button>
          </>
        )}
      </div>
    </Layout>
  );
}
