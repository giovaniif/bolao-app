import { useState, useEffect } from 'react';
import { Layout } from '../../../shared/components/Layout';
import {
  usePartialsByRound,
  usePartialClassification,
  useSetPartial,
} from '../hooks/usePartiais';
import { useRounds } from '../../matches/hooks/useMatches';
import { PartiaisTinderCard } from '../components/PartiaisTinderCard';
import { PartiaisSummaryList } from '../components/PartiaisSummaryList';

type ViewMode = 'list' | 'tinder';

export function PartiaisPage() {
  const [round, setRound] = useState<number>(0);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [partials, setPartials] = useState<
    Record<string, { h: number | null; a: number | null }>
  >({});
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const { data: rounds = [] } = useRounds();
  const { data: matches = [], isLoading } = usePartialsByRound(round);
  const { data: classification = [] } = usePartialClassification(round);
  const setPartialMutation = useSetPartial(round);

  useEffect(() => {
    if (rounds.length > 0 && (round === 0 || !rounds.includes(round))) {
      setRound(rounds[0]);
    }
  }, [rounds, round]);

  useEffect(() => {
    const map: Record<string, { h: number | null; a: number | null }> = {};
    for (const m of matches) {
      map[m.id] = {
        h: m.partial_home ?? null,
        a: m.partial_away ?? null,
      };
    }
    setPartials(map);
  }, [matches]);

  useEffect(() => {
    setCurrentCardIndex(0);
    setViewMode('list');
  }, [round]);

  function handleChange(
    matchId: string,
    home: number | null,
    away: number | null
  ) {
    setPartials((prev) => ({
      ...prev,
      [matchId]: { h: home, a: away },
    }));
  }

  async function handleSaveAll() {
    setMessage(null);
    try {
      for (const m of matches) {
        const p = partials[m.id];
        if (!p || p.h == null || p.a == null) continue;
        const currentH = m.partial_home ?? null;
        const currentA = m.partial_away ?? null;
        if (p.h !== currentH || p.a !== currentA) {
          await setPartialMutation.mutateAsync({
            matchId: m.id,
            homeGoals: p.h,
            awayGoals: p.a,
          });
        }
      }
      setMessage({ type: 'ok', text: 'Parciais salvos!' });
      setViewMode('list');
    } catch (err) {
      setMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erro ao salvar',
      });
    }
  }

  const hasPartials = matches.some(
    (m) => m.partial_home != null && m.partial_away != null
  );
  const currentMatch = matches[currentCardIndex];

  return (
    <Layout title="Parciais">
      <div className="space-y-6">
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
          <p className="text-[var(--color-text-muted)]">Carregando...</p>
        ) : matches.length === 0 ? (
          <p className="text-[var(--color-text-muted)] text-sm">
            Nenhum jogo nesta rodada.
          </p>
        ) : viewMode === 'list' ? (
          <>
            <PartiaisSummaryList
              matches={matches}
              partials={partials}
              onEdit={() => setViewMode('tinder')}
            />
            <button
              onClick={() => setViewMode('tinder')}
              className="w-full py-3 rounded-lg border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 font-medium"
            >
              Editar parciais
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--color-text-muted)]">
              Qualquer usuário pode adicionar parciais
            </p>
            <PartiaisTinderCard
              match={currentMatch}
              homeGoals={partials[currentMatch.id]?.h ?? null}
              awayGoals={partials[currentMatch.id]?.a ?? null}
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
            />

            <details className="rounded-lg bg-[var(--color-card)] border border-slate-700">
              <summary className="px-4 py-3 cursor-pointer text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
                Ver resumo dos jogos
              </summary>
              <div className="px-4 pb-4 space-y-2">
                {matches.map((m, i) => {
                  const p = partials[m.id] ?? { h: null, a: null };
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
                        {p.h ?? '–'}×{p.a ?? '–'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </details>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="flex-1 py-3 rounded-lg border border-slate-600 text-[var(--color-text-muted)] hover:bg-slate-700/50 font-medium"
              >
                Voltar
              </button>
              <button
                onClick={handleSaveAll}
                disabled={setPartialMutation.isPending}
                className="flex-1 py-3 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-medium disabled:opacity-50"
              >
                {setPartialMutation.isPending ? 'Salvando...' : 'Salvar parciais'}
              </button>
            </div>
          </>
        )}

        {hasPartials && classification.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-2">
              Classificação baseada nas parciais
            </h2>
            <div className="rounded-lg bg-[var(--color-card)] border border-slate-700 overflow-hidden">
              <div className="divide-y divide-slate-700">
                {classification.map((u, i) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between px-4 py-2"
                  >
                    <span className="font-medium">
                      {i + 1}. {u.display_name}
                    </span>
                    <span className="text-[var(--color-primary)]">
                      {u.total_points} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {hasPartials && classification.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)]">
            Adicione parciais aos jogos para ver a classificação.
          </p>
        )}
      </div>
    </Layout>
  );
}
