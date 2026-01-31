import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../../../shared/components/Layout';
import { Button } from '../../../shared/components/Button';
import { Input } from '../../../shared/components/Input';
import { useProfile, useUpdateProfile } from '../hooks/useProfile';
import { getTeams } from '../api/profileApi';
import { useAuth } from '../../../shared/hooks/useAuth';

export function ProfilePage() {
  const { data: profile, isLoading } = useProfile();
  const updateMutation = useUpdateProfile();
  const { updateUser } = useAuth();
  const [teams, setTeams] = useState<string[]>([]);
  const [form, setForm] = useState({
    username: '',
    display_name: '',
    favorite_team: '' as string,
  });

  useEffect(() => {
    getTeams().then(setTeams).catch(() => setTeams([]));
  }, []);

  useEffect(() => {
    if (profile) {
      setForm({
        username: profile.username,
        display_name: profile.display_name,
        favorite_team: profile.favorite_team || '',
      });
    }
  }, [profile]);

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
            value={form.favorite_team}
            onChange={(e) =>
              setForm((f) => ({ ...f, favorite_team: e.target.value }))
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
    </Layout>
  );
}
