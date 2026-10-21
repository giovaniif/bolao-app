import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../api/authApi';
import { Button } from '../../../shared/components/Button';
import { Input } from '../../../shared/components/Input';

export function ForgotPasswordPage() {
  const [login, setLogin] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(login.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar o link');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 safe-area-pt">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-center text-[var(--color-primary)]">Esqueci minha senha</h1>
        {sent ? (
          <p className="text-sm text-center text-[var(--color-text-muted)]">
            Se existir uma conta com e-mail para esse login, enviamos um link para criar uma nova senha. Ele vale por 1 hora.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-center text-[var(--color-text-muted)]">
              Informe seu usuário ou e-mail. Enviaremos um link para o e-mail da conta.
            </p>
            <Input
              label="Usuário ou e-mail"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <Button type="submit" className="w-full" disabled={!login.trim() || loading}>
              Enviar link
            </Button>
          </form>
        )}
        <p className="text-sm text-center">
          <Link to="/login" className="text-[var(--color-primary)] font-semibold">Voltar para o login</Link>
        </p>
      </div>
    </div>
  );
}
