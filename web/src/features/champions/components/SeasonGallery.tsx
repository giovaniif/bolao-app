import { Avatar } from '../../../shared/components/Avatar';
import type { Season } from '../hooks/useSeasons';

interface SeasonGalleryProps {
  seasons: Season[];
  onSelect: (bolaoId: string) => void;
}

/** Finished seasons, newest first. */
export function SeasonGallery({ seasons, onSelect }: SeasonGalleryProps) {
  return (
    <div className="space-y-3">
      {seasons.map((season, i) => (
        <SeasonRow key={season.bolao.id} season={season} highlight={i === 0} onSelect={onSelect} />
      ))}
    </div>
  );
}

function SeasonRow({
  season,
  highlight,
  onSelect,
}: {
  season: Season;
  highlight: boolean;
  onSelect: (bolaoId: string) => void;
}) {
  const champion = season.champion;

  return (
    <button
      type="button"
      onClick={() => onSelect(season.bolao.id)}
      className={`w-full flex items-center gap-3.5 p-4 rounded-[18px] text-left ${
        highlight ? 'bg-accent/8 border border-accent/35' : 'bg-card'
      }`}
    >
      <Avatar
        name={champion?.display_name ?? '?'}
        size={46}
        tone={highlight ? 'gold' : 'muted'}
      />
      <span className="flex-1 min-w-0">
        {/* CSS uppercase on purpose here: the text is the bolão name, and tests look for
            it as the admin wrote it. */}
        <span
          className={`block text-xs font-bold tracking-[0.1em] uppercase truncate ${
            highlight ? 'text-accent' : 'text-slate-500'
          }`}
        >
          {season.bolao.name}
        </span>
        <span className="block mt-1 text-base font-bold truncate">
          {champion?.display_name ?? '—'}
        </span>
        <span className="block mt-0.5 text-xs text-text-muted truncate">
          {champion ? `${champion.total_points} pontos · ` : ''}
          {season.players} {season.players === 1 ? 'jogador' : 'jogadores'}
        </span>
      </span>
      <span
        className={`text-lg shrink-0 ${highlight ? 'text-accent' : 'text-text-muted'}`}
        aria-hidden="true"
      >
        ›
      </span>
    </button>
  );
}
