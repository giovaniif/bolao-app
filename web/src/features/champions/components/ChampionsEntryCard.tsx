import { Link } from 'react-router-dom';
import type { Season } from '../hooks/useSeasons';

/** The Hall's entry point on Classificação, replacing the trophy emoji in the header. */
export function ChampionsEntryCard({ latest }: { latest: Season }) {
  const champion = latest.champion?.display_name;

  return (
    <Link
      to="/hall-dos-campeoes"
      className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border border-accent/35 bg-gold-entry"
    >
      <span className="flex items-center justify-center w-[38px] h-[38px] rounded-xl bg-accent/20 shrink-0">
        <span className="w-3 h-3 rounded-[2px] bg-accent rotate-45" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-accent">Hall dos Campeões</span>
        {/* The subtitle line always renders, with neutral copy until the champion loads,
            so the card does not change height. */}
        <span className="block text-xs text-text-muted truncate">
          {champion ? `Último: ${champion} · ${latest.year}` : 'Temporadas encerradas'}
        </span>
      </span>
      <span className="text-accent text-lg font-semibold shrink-0" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
