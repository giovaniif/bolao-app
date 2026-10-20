import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../../shared/components/Button';
import { useAuth } from '../../../shared/hooks/useAuth';
import { deleteAccount } from '../api/profileApi';

export function DeleteAccount() {
  const [confirming, setConfirming] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const remove = useMutation({
    mutationFn: deleteAccount,
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
      {remove.error && <p className="text-sm text-red-400">{remove.error.message}</p>}
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
        <Button className="flex-1 !bg-red-600" disabled={remove.isPending} onClick={() => remove.mutate()}>
          Sim, excluir
        </Button>
      </div>
    </div>
  );
}
