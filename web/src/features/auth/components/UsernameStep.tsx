import { useState } from 'react';
import { Button } from '../../../shared/components/Button';
import { Input } from '../../../shared/components/Input';

interface UsernameStepProps {
  loading: boolean;
  error: string;
  onSubmit: (username: string) => void;
}

export function UsernameStep({ loading, error, onSubmit }: UsernameStepProps) {
  const [username, setUsername] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(username.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-center text-[var(--color-text-muted)]">
        Falta pouco: escolha como você vai aparecer no bolão.
      </p>
      <div className="space-y-1">
        <label htmlFor="social-username" className="block text-sm font-medium text-[var(--color-text-muted)]">
          Nome de usuário
        </label>
        <Input
          id="social-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="ex.: joao.silva"
          autoComplete="username"
          autoCapitalize="none"
          autoFocus
        />
      </div>
      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading || username.trim() === ''}>
        {loading ? 'Criando...' : 'Criar conta'}
      </Button>
    </form>
  );
}
