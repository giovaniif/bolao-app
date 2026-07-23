import { useState } from 'react';
import {
  useBoloes,
  useActiveBolao,
  useCreateBolao,
  useFinishActiveBolao,
} from '../hooks/useBoloes';
import { UnresolvedMatchesError } from '../api/boloesApi';
import { Button } from '../../../shared/components/Button';
import { Input } from '../../../shared/components/Input';
import { formatDateTime } from '../../../shared/utils/date';

export function AdminBoloes() {
  const { data: boloes = [], isLoading } = useBoloes();
  const { data: active } = useActiveBolao();
  const createMutation = useCreateBolao();
  const finishMutation = useFinishActiveBolao();

  const [confirmFinish, setConfirmFinish] = useState(false);
  const [unresolved, setUnresolved] = useState<UnresolvedMatchesError | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const finished = boloes.filter((b) => b.status === 'finished');

  async function handleFinish(force: boolean) {
    setError(null);
    try {
      await finishMutation.mutateAsync(force);
      setConfirmFinish(false);
      setUnresolved(null);
    } catch (err) {
      if (err instanceof UnresolvedMatchesError) {
        setUnresolved(err);
        return;
      }
      setError(err instanceof Error ? err.message : 'Erro ao finalizar bolão');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createMutation.mutateAsync(newName);
      setNewName('');
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar bolão');
    }
  }

  if (isLoading) {
    return <p className="text-[var(--color-text-muted)]">Carregando...</p>;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {active ? (
        <div className="p-4 rounded-lg bg-[var(--color-card)] border border-slate-700 space-y-3">
          <div>
            <p className="text-sm text-[var(--color-text-muted)]">Bolão ativo</p>
            <p className="font-medium text-lg">{active.name}</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Iniciado em {formatDateTime(active.started_at)}
            </p>
          </div>

          {unresolved && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-800 space-y-2">
              <p className="text-sm text-red-300">
                {unresolved.count} jogo(s) sem resultado definido na(s) rodada(s){' '}
                {unresolved.rounds.join(', ')}.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => handleFinish(true)}
                  disabled={finishMutation.isPending}
                >
                  Finalizar mesmo assim
                </Button>
                <Button variant="ghost" onClick={() => setUnresolved(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {!unresolved &&
            (confirmFinish ? (
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => handleFinish(false)}
                  disabled={finishMutation.isPending}
                >
                  {finishMutation.isPending ? 'Finalizando...' : 'Confirmar finalização'}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmFinish(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setConfirmFinish(true)}>
                Finalizar bolão atual
              </Button>
            ))}
        </div>
      ) : (
        <div className="p-4 rounded-lg bg-[var(--color-card)] border border-slate-700">
          <p className="text-[var(--color-text-muted)]">Nenhum bolão ativo no momento.</p>
        </div>
      )}

      {!active && (
        <>
          <Button onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Cancelar' : '+ Criar novo bolão'}
          </Button>

          {showCreate && (
            <form onSubmit={handleCreate} className="p-4 rounded-lg bg-[var(--color-card)] space-y-3">
              <Input
                label="Nome do bolão"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Brasileirão 2027"
                required
              />
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Criando...' : 'Criar bolão'}
              </Button>
            </form>
          )}
        </>
      )}

      {finished.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-[var(--color-text-muted)]">Bolões encerrados</p>
          {finished.map((b) => (
            <div
              key={b.id}
              className="p-3 rounded-lg bg-[var(--color-card)] border border-slate-700"
            >
              <p className="font-medium">{b.name}</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {formatDateTime(b.started_at)}
                {b.finished_at ? ` – ${formatDateTime(b.finished_at)}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
