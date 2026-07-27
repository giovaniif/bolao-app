import type { UserWithStats } from '../api/classificationApi';

interface ClassificationRowProps {
  rank: number;
  user: UserWithStats;
  isChamp: boolean;
  medals?: boolean;
}

export function ClassificationRow({
  rank,
  user,
  isChamp,
  medals = false,
}: ClassificationRowProps) {
  const rankColor = medals
    ? rank === 1
      ? 'text-[var(--color-accent)]'
      : rank === 2
        ? 'text-slate-300'
        : rank === 3
          ? 'text-amber-600'
          : 'text-[var(--color-text-muted)]'
    : rank <= 3
      ? 'text-[var(--color-accent)]'
      : 'text-[var(--color-text-muted)]';

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg ${
        isChamp ? 'bg-[var(--color-primary)]/20 border border-[var(--color-primary)]' : 'bg-[var(--color-card)]'
      }`}
    >
      <span className={`w-8 text-center font-bold ${rankColor}`}>{rank}º</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{user.display_name}</p>
        {user.favorite_team && (
          <p className="text-xs text-[var(--color-text-muted)] truncate">
            {user.favorite_team}
          </p>
        )}
      </div>
      <div className="text-right">
        <p className="font-bold text-[var(--color-primary)]">{user.total_points}</p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {user.exact_scores} placares · {user.correct_results} resultados
        </p>
      </div>
    </div>
  );
}
