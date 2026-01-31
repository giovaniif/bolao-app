import { useState, useEffect } from 'react';
import { Layout } from '../../../shared/components/Layout';
import {
  usePartialsByRound,
  usePartialClassification,
  useSetPartial,
} from '../hooks/usePartiais';
import { useRounds } from '../../matches/hooks/useMatches';
import type { MatchWithPartial } from '../api/parciaisApi';

export function PartiaisPage() {
  const [round, setRound] = useState<number>(0);
  const { data: rounds = [] } = useRounds();
  const { data: matches = [], isLoading } = usePartialsByRound(round);
  const { data: classification = [] } = usePartialClassification(round);
  const setPartialMutation = useSetPartial(round);

  const [editing, setEditing] = useState<Record<string, { h: number; a: number }>>({});

  useEffect(() => {
    if (rounds.length > 0 && (round === 0 || !rounds.includes(round))) {
      setRound(rounds[0]);
    }
  }, [rounds, round]);

  useEffect(() => {
    const map: Record<string, { h: number; a: number }> = {};
    for (const m of matches) {
      const h = m.partial_home ?? 0;
      const a = m.partial_away ?? 0;
      map[m.id] = { h, a };
    }
    setEditing(map);
  }, [matches]);

  async function handleSave(m: MatchWithPartial) {
    const v = editing[m.id];
    if (v === undefined) return;
    try {
      await setPartialMutation.mutateAsync({
        matchId: m.id,
        homeGoals: v.h,
        awayGoals: v.a,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  }

  const hasPartials = matches.some(
    (m) => m.partial_home !== undefined || m.partial_away !== undefined
  );

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

        {isLoading ? (
          <p className="text-[var(--color-text-muted)]">Carregando...</p>
        ) : (
          <>
            <section>
              <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-2">
                Jogos — adicione os parciais (qualquer usuário pode editar)
              </h2>
              <div className="space-y-2">
                {matches.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-lg bg-[var(--color-card)] border border-slate-700"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {m.home_team} × {m.away_team}
                        </p>
                        {m.real_home_goals !== undefined && m.real_away_goals !== undefined && (
                          <p className="text-xs text-[var(--color-text-muted)]">
                            Resultado final: {m.real_home_goals}–{m.real_away_goals}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          value={editing[m.id]?.h ?? 0}
                          onChange={(e) =>
                            setEditing((prev) => ({
                              ...prev,
                              [m.id]: {
                                h: Math.max(0, parseInt(e.target.value, 10) || 0),
                                a: prev[m.id]?.a ?? 0,
                              },
                            }))
                          }
                          className="w-12 px-2 py-1 text-center rounded bg-slate-800 border border-slate-600 text-white"
                        />
                        <span className="text-slate-400">–</span>
                        <input
                          type="number"
                          min={0}
                          value={editing[m.id]?.a ?? 0}
                          onChange={(e) =>
                            setEditing((prev) => ({
                              ...prev,
                              [m.id]: {
                                h: prev[m.id]?.h ?? 0,
                                a: Math.max(0, parseInt(e.target.value, 10) || 0),
                              },
                            }))
                          }
                          className="w-12 px-2 py-1 text-center rounded bg-slate-800 border border-slate-600 text-white"
                        />
                        <button
                          onClick={() => handleSave(m)}
                          disabled={setPartialMutation.isPending}
                          className="text-sm text-[var(--color-primary)] hover:underline px-1"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {matches.length === 0 && (
                <p className="text-[var(--color-text-muted)] text-sm">
                  Nenhum jogo nesta rodada.
                </p>
              )}
            </section>

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
          </>
        )}
      </div>
    </Layout>
  );
}
