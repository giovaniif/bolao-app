import type { UserWithStats } from '../../classification/api/classificationApi';

type Place = 1 | 2 | 3;

const SPOTS: Record<Place, { emoji: string; height: string; bar: string; text: string }> = {
  1: {
    emoji: '👑',
    height: 'h-24',
    bar: 'bg-[var(--color-accent)]/15 border-[var(--color-accent)]/50',
    text: 'text-[var(--color-accent)]',
  },
  2: {
    emoji: '🥈',
    height: 'h-16',
    bar: 'bg-slate-400/10 border-slate-400/40',
    text: 'text-slate-300',
  },
  3: {
    emoji: '🥉',
    height: 'h-12',
    bar: 'bg-amber-700/10 border-amber-700/40',
    text: 'text-amber-600',
  },
};

interface PodiumProps {
  top: UserWithStats[];
  tiedForFirst?: boolean;
}

export function Podium({ top, tiedForFirst = false }: PodiumProps) {
  const [first, second, third] = top;

  if (!first) return null;

  return (
    <div className="rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 p-4">
      <div className="flex items-end gap-2">
        {second && <PodiumSpot place={2} user={second} />}
        <PodiumSpot place={1} user={first} />
        {third && <PodiumSpot place={3} user={third} />}
      </div>
      {tiedForFirst && (
        <p className="mt-3 text-xs text-center text-[var(--color-text-muted)]">
          Empate na liderança — critérios de desempate esgotados.
        </p>
      )}
    </div>
  );
}

function PodiumSpot({ place, user }: { place: Place; user: UserWithStats }) {
  const spot = SPOTS[place];

  return (
    <div className="flex-1 flex flex-col items-center min-w-0">
      <span className="text-2xl leading-none" aria-hidden="true">
        {spot.emoji}
      </span>
      <p className="mt-1 w-full text-center text-sm font-semibold truncate">
        {user.display_name}
      </p>
      {place === 1 && user.favorite_team && (
        <p className="w-full text-center text-xs text-[var(--color-text-muted)] truncate">
          {user.favorite_team}
        </p>
      )}
      <p className={`text-sm font-bold ${spot.text}`}>{user.total_points}</p>
      <div
        className={`mt-1 w-full rounded-t-lg border border-b-0 ${spot.bar} ${spot.height} flex flex-col items-center justify-center gap-0.5`}
      >
        <span className={`font-bold ${spot.text}`}>{place}º</span>
        {place === 1 && (
          <span className="text-[10px] uppercase tracking-wide text-[var(--color-accent)]">
            Campeão
          </span>
        )}
      </div>
    </div>
  );
}
