import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../api/authApi';
import { Button } from '../../../shared/components/Button';
import { Input } from '../../../shared/components/Input';

const minLength = 8;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const mismatch = confirm !== '' && confirm !== password;
  const ready = password.length >= minLength && password === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar a senha');
    } finally {
      setLoading(false);
    }
  }

  function body() {
    if (!token) {
      return (
        <>
          <p className="text-sm text-center text-[var(--color-text-muted)]">Este link não é válido. Peça um novo para redefinir a senha.</p>
          <p className="text-sm text-center">
            <Link to="/esqueci-senha" className="text-[var(--color-primary)] font-semibold">Pedir um novo link</Link>
          </p>
        </>
      );
    }
    if (done) {
      return (
        <>
          <p className="text-sm text-center text-[var(--color-text-muted)]">Senha alterada. Entre com a nova senha.</p>
          <p className="text-sm text-center">
            <Link to="/login" className="text-[var(--color-primary)] font-semibold">Entrar</Link>
          </p>
        </>
      );
    }
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nova senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="Pelo menos 8 caracteres"
          autoFocus
        />
        <Input
          label="Confirme a nova senha"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
        {mismatch && <p className="text-sm text-red-400">As senhas não conferem</p>}
        {error && (
          <div className="space-y-1 text-center">
            <p className="text-sm text-red-400">{error}</p>
            <Link to="/esqueci-senha" className="text-sm text-[var(--color-primary)] font-semibold">Pedir um novo link</Link>
          </div>
        )}
        <Button type="submit" className="w-full" disabled={!ready || loading}>
          Salvar nova senha
        </Button>
      </form>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 safe-area-pt">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-center text-[var(--color-primary)]">Criar nova senha</h1>
        {body()}
      </div>
    </div>
  );
}
