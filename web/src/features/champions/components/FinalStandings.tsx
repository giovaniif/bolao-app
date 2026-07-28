import { useState } from 'react';
import { ClassificationRow } from '../../classification/components/ClassificationRow';
import type { UserWithStats } from '../../classification/api/classificationApi';

const COLLAPSED = 5;
/** The hero and the pair already cover 1st to 3rd, so the list starts at 4th. */
const FIRST_RANK = 4;

export function FinalStandings({ ranking }: { ranking: UserWithStats[] }) {
  const [expanded, setExpanded] = useState(false);

  const rest = ranking.slice(FIRST_RANK - 1);
  if (rest.length === 0) return null;

  const shown = expanded ? rest : rest.slice(0, COLLAPSED);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold tracking-[0.1em] text-slate-500">CLASSIFICAÇÃO FINAL</h2>
        {rest.length > COLLAPSED && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-semibold text-text-muted hover:text-text"
          >
            {expanded ? 'Ver menos' : 'Ver tudo'}
          </button>
        )}
      </div>

      {shown.map((u, i) => (
        <ClassificationRow
          key={u.id}
          rank={FIRST_RANK + i}
          user={u}
          isChamp={false}
          medals
        />
      ))}
    </section>
  );
}
