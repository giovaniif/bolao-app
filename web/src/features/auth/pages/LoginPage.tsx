import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import { login } from '../api/authApi';
import { Button } from '../../../shared/components/Button';
import { Input } from '../../../shared/components/Input';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login: doLogin } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(username.trim(), password);
      doLogin(res.token, {
        id: res.user_id,
        username: res.username,
        is_admin: res.is_admin,
        must_change_password: res.must_change_password,
      });
      navigate(res.must_change_password ? '/alterar-senha' : '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-2 text-[var(--color-primary)]">
          Bolão Brasileirão
        </h1>
        <p className="text-center text-[var(--color-text-muted)] text-sm mb-8">
          Usuário e senha para acessar
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Usuário"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Seu usuário"
            autoComplete="username"
            autoFocus
          />
          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Sua senha"
            autoComplete="current-password"
          />
          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
