import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '../../../shared/components/Button';
import { useAuth } from '../../../shared/hooks/useAuth';
import { deleteAccount, getDeletionBlockers, type DeletionBlocker } from '../api/profileApi';

function OwnerPicker({ blocker, value, onChange }: { blocker: DeletionBlocker; value: string; onChange: (userId: string) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{`Quem fica como dono de ${blocker.bolao_name}?`}</legend>
      {blocker.members.map((m) => (
        <label key={m.user_id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg bg-white/5 px-3 text-sm">
          <input
            type="radio"
            name={`owner-${blocker.bolao_id}`}
            value={m.user_id}
            checked={m.user_id === value}
            onChange={() => onChange(m.user_id)}
            aria-label={m.display_name}
          />
          <span className="flex-1">{m.display_name}</span>
          {m.role === 'admin' && <span className="text-xs text-slate-400">admin</span>}
        </label>
      ))}
    </fieldset>
  );
}

export function DeleteAccount() {
  const [confirming, setConfirming] = useState(false);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const { logout } = useAuth();
  const navigate = useNavigate();
  const check = useQuery({ queryKey: ['deletion-check'], queryFn: getDeletionBlockers, enabled: confirming });
  const blockers = check.data ?? [];
  const newOwners = Object.fromEntries(blockers.map((b) => [b.bolao_id, chosen[b.bolao_id] ?? b.suggested_owner_id]));
  const remove = useMutation({
    mutationFn: () => deleteAccount(newOwners),
    onSuccess: () => {
      logout();
      navigate('/login');
    },
  });

  if (!confirming) {
    return (
      <button type="button" className="px-4 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10" onClick={() => setConfirming(true)}>
        Excluir minha conta
      </button>
    );
  }
  return (
    <div className="rounded-xl border border-red-500/40 p-4 space-y-3">
      <p className="text-sm">
        Sua conta, seus dados de acesso e seus pedidos saem de todos os bolões. Isso não pode ser desfeito.
      </p>
      {check.isLoading ? (
        <p className="text-sm text-slate-400">Carregando…</p>
      ) : check.error ? (
        <p className="text-sm text-red-400">{check.error.message}</p>
      ) : (
        <>
          {blockers.map((b) => (
            <OwnerPicker key={b.bolao_id} blocker={b} value={newOwners[b.bolao_id]} onChange={(userId) => setChosen({ ...chosen, [b.bolao_id]: userId })} />
          ))}
          {remove.error && <p className="text-sm text-red-400">{remove.error.message}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button className="flex-1 !bg-red-600" disabled={remove.isPending} onClick={() => remove.mutate()}>
              Sim, excluir
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
