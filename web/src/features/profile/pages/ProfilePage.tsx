import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../../../shared/components/Layout';
import { Button } from '../../../shared/components/Button';
import { Input } from '../../../shared/components/Input';
import { useProfile, useUpdateProfile } from '../hooks/useProfile';
import { getTeams } from '../api/profileApi';
import { useAuth } from '../../../shared/hooks/useAuth';

export function ProfilePage() {
  const { data: profile, isLoading } = useProfile();
  const updateMutation = useUpdateProfile();
  const { updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<string[]>([]);
  const [edits, setEdits] = useState<
    Partial<{ username: string; display_name: string; favorite_team: string }>
  >({});

  useEffect(() => {
    getTeams().then(setTeams).catch(() => setTeams([]));
  }, []);

  const form = {
    username: profile?.username ?? '',
    display_name: profile?.display_name ?? '',
    favorite_team: profile?.favorite_team ?? '',
    ...edits,
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const updated = await updateMutation.mutateAsync({
        username: form.username.trim(),
        display_name: form.display_name.trim(),
        favorite_team: form.favorite_team || null,
      });
      updateUser({ username: updated.username });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  }

  if (isLoading) {
    return (
      <Layout title="Meu perfil">
        <p className="text-[var(--color-text-muted)]">Carregando...</p>
      </Layout>
    );
  }

  return (
    <Layout title="Meu perfil">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Usuário (para login)"
          value={form.username}
          onChange={(e) => setEdits((f) => ({ ...f, username: e.target.value }))}
          required
        />
        <Input
          label="Nome"
          value={form.display_name}
          onChange={(e) => setEdits((f) => ({ ...f, display_name: e.target.value }))}
          required
        />
        <div>
          <label className="block text-sm text-[var(--color-text-muted)] mb-1">
            Time do coração
          </label>
          <select
            value={form.favorite_team}
            onChange={(e) =>
              setEdits((f) => ({ ...f, favorite_team: e.target.value }))
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
        <Button type="submit" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
        <p className="text-sm">
          <Link
            to="/alterar-senha"
            className="text-[var(--color-primary)] hover:underline"
          >
            Alterar senha
          </Link>
        </p>
      </form>

      <div className="mt-8 pt-4 border-t border-card">
        <Button
          variant="ghost"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          Sair
        </Button>
      </div>
    </Layout>
  );
}
