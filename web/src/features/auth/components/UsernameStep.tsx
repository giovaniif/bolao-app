import type { UsernameStatus } from '../hooks/useUsernameAvailability';
import { OnboardingScreen } from './OnboardingScreen';

interface UsernameStepProps {
  username: string;
  status: UsernameStatus;
  loading: boolean;
  error: string;
  onChange: (username: string) => void;
  onSubmit: () => void;
}

const STATUS_TEXT: Record<UsernameStatus, string> = {
  checking: '',
  available: 'Disponível',
  taken: 'Em uso',
  invalid: '',
};

export function UsernameStep({ username, status, loading, error, onChange, onSubmit }: UsernameStepProps) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'available') onSubmit();
  }

  return (
    <OnboardingScreen step={1} title="Como você quer aparecer no bolão?">
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4">
        <p className="text-sm text-[var(--color-text-muted)]">
          É o nome que todo mundo vê na classificação. Você também entra com ele.
        </p>
        <label htmlFor="social-username" className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
          Nome de usuário
        </label>
        <div
          className={`flex items-center gap-3 h-13 px-4 rounded-2xl bg-[var(--color-card)] border ${
            status === 'available' ? 'border-[var(--color-primary)]' : status === 'checking' ? 'border-slate-600' : 'border-red-400'
          }`}
        >
          <input
            id="social-username"
            value={username}
            onChange={(e) => onChange(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            className="flex-1 min-w-0 h-12 bg-transparent text-base font-semibold text-white focus:outline-none"
          />
          {STATUS_TEXT[status] && (
            <span className={`text-xs font-bold ${status === 'available' ? 'text-emerald-400' : 'text-red-400'}`}>
              {STATUS_TEXT[status]}
            </span>
          )}
        </div>
        {status === 'invalid' && (
          <p className="text-sm text-red-400">Use de 3 a 30 letras, números, ponto ou _</p>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex-1" />
        <button
          type="submit"
          disabled={loading || status !== 'available'}
          className="h-13 min-h-12 rounded-full bg-[var(--color-primary)] text-on-primary font-extrabold disabled:opacity-50"
        >
          {loading ? 'Criando...' : 'Continuar'}
        </button>
      </form>
    </OnboardingScreen>
  );
}
