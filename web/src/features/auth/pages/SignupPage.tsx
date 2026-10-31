import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import { signup } from '../api/authApi';
import { Button } from '../../../shared/components/Button';
import { track } from '../../../shared/analytics/analytics';
import { SocialSignIn } from '../components/SocialSignIn';

const fieldClass =
  'w-full px-3 py-2 rounded-lg bg-card border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary';

function Field({ id, label, ...props }: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm text-text-muted">{label}</label>
      <input id={id} className={fieldClass} {...props} />
    </div>
  );
}

export function SignupPage() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const voltar = searchParams.get('voltar');
  const next = voltar && voltar.startsWith('/') && !voltar.startsWith('//') ? voltar : '/meus-boloes';
  const ready = displayName.trim() && username.trim().length >= 3 && email.includes('@') && password.length >= 8;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await signup({ username: username.trim().toLowerCase(), display_name: displayName.trim(), email: email.trim(), password });
      login(res.token, { id: res.user_id, username: res.username, is_admin: res.is_admin, must_change_password: false });
      track('signed_up');
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar a conta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 safe-area-pt">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-center text-primary">Criar conta</h1>
        <Field id="signup-name" label="Seu nome" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" />
        <Field id="signup-username" label="Nome de usuário" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" placeholder="joao.silva" />
        <Field id="signup-email" label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <Field id="signup-password" label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="Pelo menos 8 caracteres" />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="submit" className="w-full" disabled={!ready || loading}>Criar conta</Button>
        <p className="text-sm text-center text-text-muted">
          Já tem conta?{' '}
          <Link to={voltar ? `/login?voltar=${encodeURIComponent(voltar)}` : '/login'} className="text-primary font-semibold">Entrar</Link>
        </p>
      </form>
      <div className="mt-4 w-full max-w-sm">
        <SocialSignIn next={next} />
      </div>
    </div>
  );
}
