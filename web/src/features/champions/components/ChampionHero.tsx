import { Avatar } from '../../../shared/components/Avatar';
import type { Season } from '../hooks/useSeasons';

interface ChampionHeroProps {
  season: Season;
  /** Rounds in the season; absent while loading. */
  rounds?: number;
}

export function ChampionHero({ season, rounds }: ChampionHeroProps) {
  const { champion, margin, year } = season;
  if (!champion) return null;

  const subtitle = [champion.favorite_team, margin > 0 ? `venceu por ${margin} pontos` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="rounded-[22px] p-5 border border-accent/45 bg-gold-hero flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        {/* Uppercase in the JSX, not via CSS: Testing Library matches DOM text. */}
        <span className="text-[11px] font-extrabold tracking-[0.14em] text-accent">
          CAMPEÃO {year}
        </span>
        {rounds != null && (
          <span className="text-[11px] font-semibold text-text-muted shrink-0">
            {rounds} {rounds === 1 ? 'rodada' : 'rodadas'}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Avatar name={champion.display_name} size={64} tone="gold" />
        <div className="flex-1 min-w-0">
          <p className="text-[22px] font-extrabold tracking-tight truncate">
            {champion.display_name}
          </p>
          {subtitle && <p className="mt-0.5 text-[13px] text-text-muted truncate">{subtitle}</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <Stat value={champion.total_points} label="pontos" gold />
        <Stat value={champion.exact_scores} label="placares" />
        <Stat value={champion.rounds_won} label="rodadas vencidas" />
      </div>
    </div>
  );
}

function Stat({ value, label, gold = false }: { value: number; label: string; gold?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 p-3 rounded-[14px] bg-bg/60">
      <span className={`text-xl font-extrabold ${gold ? 'text-accent' : 'text-text'}`}>
        {value}
      </span>
      <span className="text-[11px] text-text-muted">{label}</span>
    </div>
  );
}
