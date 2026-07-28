import { useMemo } from 'react';
import type { Season } from '../hooks/useSeasons';
import { tallyTitles } from '../utils/titles';

export function BiggestWinners({ seasons }: { seasons: Season[] }) {
  const winners = useMemo(() => tallyTitles(seasons), [seasons]);

  if (winners.length === 0) return null;

  const most = winners[0].titles;

  return (
    <section className="flex flex-col gap-3 mt-1 p-4 rounded-[18px] border border-card">
      <h2 className="text-xs font-bold tracking-[0.1em] text-slate-500">MAIORES VENCEDORES</h2>
      {winners.map((w) => (
        <div key={w.id} className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold truncate">{w.name}</span>
          <span
            className={`text-[13px] font-bold shrink-0 ${
              w.titles === most ? 'text-accent' : 'text-text-muted'
            }`}
          >
            {w.titles} {w.titles === 1 ? 'título' : 'títulos'}
          </span>
        </div>
      ))}
    </section>
  );
}
