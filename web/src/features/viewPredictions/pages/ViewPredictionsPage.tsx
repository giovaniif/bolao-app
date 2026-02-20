import { useState, useEffect } from 'react';
import { Layout } from '../../../shared/components/Layout';
import { useRounds, useMatchesByRound } from '../../matches/hooks/useMatches';
import { useUsers, usePredictionsByUser } from '../hooks/useViewPredictions';
import type { Match } from '../../matches/api/matchesApi';

export function ViewPredictionsPage() {
  const [round, setRound] = useState<number>(0);
  const [userId, setUserId] = useState<string>('');

  const { data: rounds = [] } = useRounds();
  const { data: matches = [], isLoading: matchesLoading } = useMatchesByRound(round);
  const { data: users = [], isLoading: usersLoading } = useUsers();

  function isClosed(m: Match): boolean {
    if (!m.market_closes_at) return false;
    return new Date(m.market_closes_at) < new Date();
  }
  const roundClosed =
    round > 0 && matches.length > 0 && matches.every(isClosed);

  const { data: predictions = [], isLoading: predsLoading } = usePredictionsByUser(
    round,
    roundClosed ? userId : null
  );

  useEffect(() => {
    if (rounds.length > 0 && (round === 0 || !rounds.includes(round))) {
      setRound(rounds[0]);
    }
  }, [rounds, round]);

  useEffect(() => {
    if (userId && users.length > 0 && !users.some((u) => u.id === userId)) {
      setUserId('');
    }
  }, [users, userId]);
  const selectedUser = users.find((u) => u.id === userId);
  const predByMatch = Object.fromEntries(
    predictions.map((p) => [p.match_id, { h: p.home_goals, a: p.away_goals }])
  );

  return (
    <Layout title="Ver palpites">
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-text-muted)]">
          Veja os palpites de qualquer jogador após o fechamento do mercado da rodada.
        </p>

        <div>
          <label className="block text-sm text-[var(--color-text-muted)] mb-1">
            Rodada
          </label>
          <select
            value={round || ''}
            onChange={(e) => setRound(Number(e.target.value) || 0)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--color-card)] border border-slate-600 text-white"
          >
            <option value="">Selecione</option>
            {rounds.map((r) => (
              <option key={r} value={r}>
                Rodada {r}
              </option>
            ))}
          </select>
        </div>

        {round > 0 && matches.length > 0 && !roundClosed && (
          <p className="text-sm text-amber-400">
            O mercado desta rodada ainda não fechou. Os palpites dos jogadores só podem ser vistos após o fechamento.
          </p>
        )}

        {roundClosed && (
          <>
            <div>
              <label className="block text-sm text-[var(--color-text-muted)] mb-1">
                Jogador
              </label>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-card)] border border-slate-600 text-white"
              >
                <option value="">Selecione o jogador</option>
                {users
                  .slice()
                  .sort((a, b) => a.display_name.localeCompare(b.display_name))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.display_name}
                    </option>
                  ))}
              </select>
            </div>

            {userId && (
              <>
                {matchesLoading || usersLoading || predsLoading ? (
                  <p className="text-[var(--color-text-muted)] py-4">
                    Carregando...
                  </p>
                ) : (
                  <div className="space-y-2">
                    <h2 className="text-base font-medium">
                      Palpites de {selectedUser?.display_name ?? ''}
                    </h2>
                    <div className="rounded-lg bg-[var(--color-card)] border border-slate-700 overflow-hidden">
                      <div className="divide-y divide-slate-700">
                        {matches.map((m) => {
                          const pred = predByMatch[m.id];
                          return (
                            <div
                              key={m.id}
                              className="flex items-center justify-between px-4 py-3"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 text-sm flex-wrap">
                                  <span className="truncate">{m.home_team}</span>
                                  <span className="text-[var(--color-text-muted)] shrink-0">
                                    {pred != null
                                      ? `${pred.h} × ${pred.a}`
                                      : '–'}
                                  </span>
                                  <span className="truncate">{m.away_team}</span>
                                </div>
                                {m.home_goals != null && m.away_goals != null && (
                                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                    Resultado: {m.home_goals}×{m.away_goals}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {matches.length > 0 && predictions.length === 0 && (
                      <p className="text-sm text-[var(--color-text-muted)]">
                        Nenhum palpite registrado para esta rodada.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {round > 0 && matches.length === 0 && !matchesLoading && (
          <p className="text-sm text-[var(--color-text-muted)]">
            Nenhum jogo nesta rodada.
          </p>
        )}
      </div>
    </Layout>
  );
}
