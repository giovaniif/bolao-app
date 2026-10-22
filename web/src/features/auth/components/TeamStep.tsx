import { TeamCrest } from '../../../shared/components/TeamCrest';
import { OnboardingScreen } from './OnboardingScreen';

interface TeamStepProps {
  teams: string[];
  query: string;
  selected: string;
  saving: boolean;
  error: string;
  onQueryChange: (query: string) => void;
  onSelect: (team: string) => void;
  onStart: () => void;
  onSkip: () => void;
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function TeamStep({ teams, query, selected, saving, error, onQueryChange, onSelect, onStart, onSkip }: TeamStepProps) {
  const visible = teams.filter((t) => normalize(t).includes(normalize(query.trim())));
  const sorted = [...visible].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  return (
    <OnboardingScreen step={2} title="Pra qual time você torce?">
      <input
        type="search"
        aria-label="Buscar time"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Buscar time"
        className="h-11 px-4 rounded-full bg-[var(--color-card)] text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      />
      <div className="grid grid-cols-4 gap-2.5">
        {sorted.map((team) => {
          const on = team === selected;
          return (
            <button
              key={team}
              type="button"
              aria-pressed={on}
              aria-label={team}
              onClick={() => onSelect(team)}
              className={`flex flex-col items-center gap-1.5 px-1 py-2.5 rounded-2xl border-[1.5px] text-[10.5px] font-bold text-center ${
                on
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-white'
                  : 'border-transparent bg-[var(--color-card)] text-slate-300'
              }`}
            >
              <TeamCrest team={team} />
              <span className="w-full leading-tight [overflow-wrap:anywhere]">{team}</span>
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex-1" />
      <button
        type="button"
        onClick={onStart}
        disabled={saving || selected === ''}
        className="min-h-12 rounded-full bg-[var(--color-primary)] text-on-primary font-extrabold disabled:opacity-50"
      >
        {saving ? 'Salvando...' : 'Começar'}
      </button>
      <button type="button" onClick={onSkip} className="text-sm text-[var(--color-text-muted)]">
        Pular por agora
      </button>
    </OnboardingScreen>
  );
}
