import { formatDateTime } from '../../../shared/utils/date';
import type { Match } from '../../matches/api/matchesApi';

interface PredictionsSummaryListProps {
  matches: Match[];
  predictions: Record<string, { h: number; a: number }>;
  onEdit: () => void;
  isClosed: (m: Match) => boolean;
}

export function PredictionsSummaryList({
  matches,
  predictions,
  onEdit,
  isClosed,
}: PredictionsSummaryListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">Resumo dos palpites</h2>
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
          const pred = predictions[m.id] ?? { h: 0, a: 0 };
          const closed = isClosed(m);
          return (
            <div
              key={m.id}
              className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-card)] border border-slate-700"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="truncate">{m.home_team}</span>
                  <span className="text-[var(--color-text-muted)] shrink-0">
                    {pred.h} × {pred.a}
                  </span>
                  <span className="truncate">{m.away_team}</span>
                </div>
                {m.market_closes_at && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {closed && (
                      <span className="text-amber-400 mr-1">(fechado)</span>
                    )}
                    Fecha: {formatDateTime(m.market_closes_at)}
                  </p>
                )}
              </div>
              {m.home_goals != null && m.away_goals != null && (
                <span className="text-xs text-[var(--color-text-muted)] shrink-0 ml-2">
                  {m.home_goals}×{m.away_goals}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
