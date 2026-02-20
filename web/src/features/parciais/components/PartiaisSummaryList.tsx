import type { MatchWithPartial } from '../api/parciaisApi';

interface PartiaisSummaryListProps {
  matches: MatchWithPartial[];
  partials: Record<string, { h: number | null; a: number | null }>;
  onEdit: () => void;
}

export function PartiaisSummaryList({
  matches,
  partials,
  onEdit,
}: PartiaisSummaryListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">Parciais da rodada</h2>
        <button
          type="button"
          onClick={onEdit}
          className="text-sm text-[var(--color-primary)] hover:underline font-medium"
        >
          Editar
        </button>
      </div>

      <div className="space-y-2">
        {matches.map((m) => {
          const p = partials[m.id] ?? { h: null, a: null };
          return (
            <div
              key={m.id}
              className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-card)] border border-slate-700"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="truncate">{m.home_team}</span>
                  <span className="text-[var(--color-text-muted)] shrink-0">
                    {p.h ?? '–'} × {p.a ?? '–'}
                  </span>
                  <span className="truncate">{m.away_team}</span>
                </div>
                {m.real_home_goals !== undefined && m.real_away_goals !== undefined && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    Resultado final: {m.real_home_goals}×{m.real_away_goals}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
