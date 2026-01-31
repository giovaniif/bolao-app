import { useState, useEffect } from 'react';
import {
  formatDateTime,
  toDateTimeLocalValue,
  fromDateTimeLocalValue,
} from '../../../shared/utils/date';
import {
  useRounds,
  useMatchesByRound,
  useCreateMatches,
  useUpdateMatch,
  useUpdateMatchResults,
  useUpdateRoundCloses,
  useDeleteMatch,
  useDeleteRound,
  useTeams,
} from '../hooks/useAdmin';
import type { Match } from '../api/adminApi';
import { Button } from '../../../shared/components/Button';
import { Input } from '../../../shared/components/Input';

export function AdminMatches() {
  const [round, setRound] = useState<number>(1);
  const [showAdd, setShowAdd] = useState(false);
  const [newRound, setNewRound] = useState(1);
  const [marketCloses, setMarketCloses] = useState('');
  const [newMatches, setNewMatches] = useState<{ home: string; away: string }[]>([
    { home: '', away: '' },
  ]);
  const [editingResult, setEditingResult] = useState<string | null>(null);
  const [resultForm, setResultForm] = useState({ home: 0, away: 0 });
  const [editingMatch, setEditingMatch] = useState<string | null>(null);
  const [editMatchForm, setEditMatchForm] = useState({ home: '', away: '' });
  const [editingCloses, setEditingCloses] = useState(false);
  const [closesAt, setClosesAt] = useState('');
  const [confirmDeleteRound, setConfirmDeleteRound] = useState(false);

  const { data: rounds = [] } = useRounds();
  const { data: teams = [] } = useTeams();
  const { data: matches = [], isLoading } = useMatchesByRound(round);

  const createMatchesMutation = useCreateMatches();
  const updateMatchMutation = useUpdateMatch(round);
  const updateResultMutation = useUpdateMatchResults(round);
  const updateClosesMutation = useUpdateRoundCloses(round);
  const deleteMatchMutation = useDeleteMatch(round);
  const deleteRoundMutation = useDeleteRound();

  useEffect(() => {
    if (rounds.length > 0 && !rounds.includes(round)) {
      setRound(rounds[0]);
    }
  }, [rounds, round]);

  useEffect(() => {
    if (matches.length > 0 && matches[0].market_closes_at) {
      setClosesAt((prev) => prev || toDateTimeLocalValue(matches[0].market_closes_at!));
    }
  }, [matches]);

  async function handleCreateMatches(e: React.FormEvent) {
    e.preventDefault();
    const filtered = newMatches.filter((m) => m.home && m.away);
    if (filtered.length === 0) {
      alert('Adicione pelo menos um jogo');
      return;
    }
    try {
      await createMatchesMutation.mutateAsync({
        round: newRound,
        market_closes_at: marketCloses ? fromDateTimeLocalValue(marketCloses) : undefined,
        matches: filtered.map((m) => ({ home_team: m.home, away_team: m.away })),
      });
      setRound(newRound);
      setShowAdd(false);
      setNewMatches([{ home: '', away: '' }]);
      setMarketCloses('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro');
    }
  }

  function addMatch() {
    setNewMatches((prev) => [...prev, { home: '', away: '' }]);
  }

  async function handleSaveResult(matchId: string) {
    try {
      await updateResultMutation.mutateAsync({
        matchId,
        homeGoals: resultForm.home,
        awayGoals: resultForm.away,
      });
      setEditingResult(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handleSaveCloses() {
    if (!closesAt) return;
    try {
      await updateClosesMutation.mutateAsync(fromDateTimeLocalValue(closesAt));
      setEditingCloses(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handleUpdateMatch(matchId: string) {
    if (!editMatchForm.home || !editMatchForm.away) return;
    try {
      await updateMatchMutation.mutateAsync({
        matchId,
        home_team: editMatchForm.home,
        away_team: editMatchForm.away,
      });
      setEditingMatch(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handleDeleteMatch(matchId: string) {
    if (!confirm('Excluir este jogo? Os palpites vinculados também serão excluídos.')) return;
    try {
      await deleteMatchMutation.mutateAsync(matchId);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handleDeleteRound() {
    if (!confirm(`Excluir toda a rodada ${round}? Todos os jogos e palpites serão excluídos.`)) return;
    try {
      await deleteRoundMutation.mutateAsync(round);
      if (rounds.length > 1) {
        const next = rounds.find((r) => r !== round) ?? rounds[0];
        setRound(next);
      }
      setConfirmDeleteRound(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="block text-sm text-[var(--color-text-muted)]">
            Rodada
          </label>
          {matches.length > 0 && (
            <>
              {confirmDeleteRound ? (
                <span className="flex gap-1 text-sm">
                  <button
                    onClick={handleDeleteRound}
                    disabled={deleteRoundMutation.isPending}
                    className="text-red-400 hover:underline"
                  >
                    Confirmar exclusão
                  </button>
                  <button
                    onClick={() => setConfirmDeleteRound(false)}
                    className="text-[var(--color-text-muted)] hover:underline"
                  >
                    Cancelar
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmDeleteRound(true)}
                  className="text-sm text-red-400 hover:underline"
                >
                  Excluir rodada
                </button>
              )}
            </>
          )}
        </div>
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

      <Button onClick={() => setShowAdd(!showAdd)}>
        {showAdd ? 'Cancelar' : '+ Adicionar jogos'}
      </Button>

      {showAdd && (
        <form onSubmit={handleCreateMatches} className="p-4 rounded-lg bg-[var(--color-card)] space-y-3">
          <Input
            label="Rodada"
            type="number"
            value={newRound}
            onChange={(e) => setNewRound(parseInt(e.target.value) || 1)}
          />
          <Input
            label="Data/hora fechamento"
            type="datetime-local"
            value={marketCloses}
            onChange={(e) => setMarketCloses(e.target.value)}
          />
          {newMatches.map((m, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select
                value={m.home}
                onChange={(e) =>
                  setNewMatches((prev) => {
                    const n = [...prev];
                    n[i] = { ...n[i], home: e.target.value };
                    return n;
                  })
                }
                className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white"
              >
                <option value="">Mandante</option>
                {teams.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <span className="text-[var(--color-text-muted)]">x</span>
              <select
                value={m.away}
                onChange={(e) =>
                  setNewMatches((prev) => {
                    const n = [...prev];
                    n[i] = { ...n[i], away: e.target.value };
                    return n;
                  })
                }
                className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white"
              >
                <option value="">Visitante</option>
                {teams.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <button
            type="button"
            onClick={addMatch}
            className="text-sm text-[var(--color-primary)]"
          >
            + Adicionar jogo
          </button>
          <Button type="submit" disabled={createMatchesMutation.isPending}>
            {createMatchesMutation.isPending ? 'Criando...' : 'Criar jogos'}
          </Button>
        </form>
      )}

      {matches.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-[var(--color-text-muted)]">
              Fechamento do mercado
            </span>
            {editingCloses ? (
              <div className="flex gap-1">
                <input
                  type="datetime-local"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                  className="px-2 py-1 text-sm rounded bg-slate-800 border border-slate-600 text-white"
                />
                <button
                  onClick={handleSaveCloses}
                  disabled={updateClosesMutation.isPending}
                  className="text-sm text-[var(--color-primary)]"
                >
                  Ok
                </button>
                <button
                  onClick={() => setEditingCloses(false)}
                  className="text-sm text-[var(--color-text-muted)]"
                >
                  X
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingCloses(true)}
                className="text-sm"
              >
                {matches[0]?.market_closes_at
                  ? formatDateTime(matches[0].market_closes_at)
                  : 'Definir'}
              </button>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-[var(--color-text-muted)]">Carregando...</p>
      ) : (
        <div className="space-y-2">
          {matches.map((m) => (
            <MatchRow
              key={m.id}
              match={m}
              teams={teams}
              editingResult={editingResult}
              resultForm={resultForm}
              editingMatch={editingMatch}
              editMatchForm={editMatchForm}
              setEditingResult={setEditingResult}
              setResultForm={setResultForm}
              setEditingMatch={setEditingMatch}
              setEditMatchForm={setEditMatchForm}
              onSaveResult={handleSaveResult}
              onUpdateMatch={handleUpdateMatch}
              onDeleteMatch={handleDeleteMatch}
              isUpdating={updateMatchMutation.isPending}
              isDeleting={deleteMatchMutation.isPending}
            />
          ))}
        </div>
      )}

      {matches.length === 0 && !isLoading && !showAdd && (
        <p className="text-[var(--color-text-muted)] text-center py-8">
          Nenhum jogo. Adicione jogos para a rodada.
        </p>
      )}
    </div>
  );
}

function MatchRow({
  match,
  teams,
  editingResult,
  resultForm,
  editingMatch,
  editMatchForm,
  setEditingResult,
  setResultForm,
  setEditingMatch,
  setEditMatchForm,
  onSaveResult,
  onUpdateMatch,
  onDeleteMatch,
  isUpdating,
  isDeleting,
}: {
  match: Match;
  teams: string[];
  editingResult: string | null;
  resultForm: { home: number; away: number };
  editingMatch: string | null;
  editMatchForm: { home: string; away: string };
  setEditingResult: (id: string | null) => void;
  setResultForm: React.Dispatch<React.SetStateAction<{ home: number; away: number }>>;
  setEditingMatch: (id: string | null) => void;
  setEditMatchForm: React.Dispatch<React.SetStateAction<{ home: string; away: string }>>;
  onSaveResult: (matchId: string) => void;
  onUpdateMatch: (matchId: string) => void;
  onDeleteMatch: (matchId: string) => void;
  isUpdating: boolean;
  isDeleting: boolean;
}) {
  const isEditingMatch = editingMatch === match.id;
  return (
    <div className="p-3 rounded-lg bg-[var(--color-card)] border border-slate-700">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center justify-end gap-1">
          {isEditingMatch ? (
            <>
              <select
                value={editMatchForm.home}
                onChange={(e) => setEditMatchForm((f) => ({ ...f, home: e.target.value }))}
                className="flex-1 min-w-0 max-w-[110px] px-2 py-1 text-sm rounded bg-slate-800 border border-slate-600 text-white truncate"
              >
                <option value="">Mandante</option>
                {teams.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <span className="text-[var(--color-text-muted)] shrink-0">x</span>
              <select
                value={editMatchForm.away}
                onChange={(e) => setEditMatchForm((f) => ({ ...f, away: e.target.value }))}
                className="flex-1 min-w-0 max-w-[110px] px-2 py-1 text-sm rounded bg-slate-800 border border-slate-600 text-white truncate"
              >
                <option value="">Visitante</option>
                {teams.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <button
                onClick={() => onUpdateMatch(match.id)}
                disabled={!editMatchForm.home || !editMatchForm.away || isUpdating}
                className="text-xs text-[var(--color-primary)] shrink-0"
              >
                Ok
              </button>
              <button
                onClick={() => setEditingMatch(null)}
                className="text-xs text-[var(--color-text-muted)] shrink-0"
              >
                X
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setEditingMatch(match.id);
                setEditMatchForm({ home: match.home_team, away: match.away_team });
                setEditingResult(null);
              }}
              className="text-right truncate w-full py-1"
            >
              {match.home_team}
            </button>
          )}
        </div>
        {!isEditingMatch && (
          <>
            <span className="text-[var(--color-text-muted)] shrink-0">x</span>
            {editingResult === match.id ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              value={resultForm.home}
              onChange={(e) =>
                setResultForm((f) => ({
                  ...f,
                  home: parseInt(e.target.value) || 0,
                }))
              }
              className="w-10 py-1 text-center rounded bg-slate-800 border border-slate-600 text-white"
            />
            <span className="text-[var(--color-text-muted)]">x</span>
            <input
              type="number"
              min={0}
              value={resultForm.away}
              onChange={(e) =>
                setResultForm((f) => ({
                  ...f,
                  away: parseInt(e.target.value) || 0,
                }))
              }
              className="w-10 py-1 text-center rounded bg-slate-800 border border-slate-600 text-white"
            />
            <button
              onClick={() => onSaveResult(match.id)}
              className="text-xs text-[var(--color-primary)] ml-1"
            >
              Ok
            </button>
            <button
              onClick={() => setEditingResult(null)}
              className="text-xs text-[var(--color-text-muted)]"
            >
              X
            </button>
          </div>
        ) : (
            <button
              onClick={() => {
                setEditingResult(match.id);
                setResultForm({
                  home: match.home_goals ?? 0,
                  away: match.away_goals ?? 0,
                });
                setEditingMatch(null);
              }}
              className="px-3 py-1 rounded bg-slate-800 font-mono shrink-0"
            >
              {match.home_goals != null && match.away_goals != null
                ? `${match.home_goals} x ${match.away_goals}`
                : 'Definir resultado'}
            </button>
          )}
            <span className="flex-1 min-w-0 truncate text-left">{match.away_team}</span>
          </>
        )}
        <button
          onClick={() => onDeleteMatch(match.id)}
          disabled={isDeleting}
          className="text-red-400 hover:text-red-300 p-1 shrink-0"
          title="Excluir jogo"
        >
          🗑
        </button>
      </div>
    </div>
  );
}
