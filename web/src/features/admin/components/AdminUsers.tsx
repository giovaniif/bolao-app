import { useState } from 'react';
import {
  useUsers,
  useTeams,
  useCreateUser,
  useUpdateUser,
} from '../hooks/useAdmin';
import type { User } from '../api/adminApi';
import { Button } from '../../../shared/components/Button';
import { Input } from '../../../shared/components/Input';

const TOTAL_VALUE = 70;

export function AdminUsers() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    username: '',
    display_name: '',
    favorite_team: '' as string | undefined,
    is_admin: false,
  });
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  const { data: users = [], isLoading } = useUsers();
  const { data: teams = [] } = useTeams();
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createUserMutation.mutateAsync({
        ...form,
        favorite_team: form.favorite_team || undefined,
      });
      setForm({ username: '', display_name: '', favorite_team: '', is_admin: false });
      setShowForm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function handleUpdatePayment(userId: string) {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount < 0) return;
    try {
      await updateUserMutation.mutateAsync({ id: userId, data: { amount_paid: amount } });
      setEditingPayment(null);
      setPaymentAmount('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro');
    }
  }

  if (isLoading) {
    return <p className="text-[var(--color-text-muted)]">Carregando...</p>;
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => setShowForm(!showForm)}>
        {showForm ? 'Cancelar' : '+ Novo usuário'}
      </Button>

      {showForm && (
        <form onSubmit={handleCreate} className="p-4 rounded-lg bg-[var(--color-card)] space-y-3">
          <Input
            label="Usuário (para login)"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            required
          />
          <Input
            label="Nome"
            value={form.display_name}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            required
          />
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">
              Time do coração
            </label>
            <select
              value={form.favorite_team || ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, favorite_team: e.target.value || undefined }))
              }
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white"
            >
              <option value="">Selecione</option>
              {teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_admin}
              onChange={(e) => setForm((f) => ({ ...f, is_admin: e.target.checked }))}
            />
            <span className="text-sm">Administrador</span>
          </label>
          <Button type="submit" disabled={createUserMutation.isPending}>
            {createUserMutation.isPending ? 'Cadastrando...' : 'Cadastrar'}
          </Button>
        </form>
      )}

      <div className="space-y-2">
        {users.map((u: User) => (
          <div
            key={u.id}
            className="p-3 rounded-lg bg-[var(--color-card)] border border-slate-700"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">{u.display_name}</p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  @{u.username}
                  {u.favorite_team && ` · ${u.favorite_team}`}
                  {u.is_admin && ' · Admin'}
                </p>
              </div>
              <div className="text-right">
                {editingPayment === u.id ? (
                  <div className="flex gap-1">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-16 px-2 py-1 text-sm rounded bg-slate-800 border border-slate-600 text-white"
                    />
                    <button
                      onClick={() => handleUpdatePayment(u.id)}
                      className="text-xs text-[var(--color-primary)]"
                    >
                      Ok
                    </button>
                    <button
                      onClick={() => {
                        setEditingPayment(null);
                        setPaymentAmount('');
                      }}
                      className="text-xs text-[var(--color-text-muted)]"
                    >
                      X
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingPayment(u.id);
                      setPaymentAmount(String(u.amount_paid));
                    }}
                    className="text-sm text-[var(--color-primary)] hover:underline"
                    title="Editar valor pago"
                  >
                    R$ {u.amount_paid.toFixed(2)} / {TOTAL_VALUE} ✎
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
