import type { Match } from '../api/adminApi';

export function FeedBadge({
  match,
  onUnlock,
  isUnlocking = false,
}: {
  match: Match;
  onUnlock: (matchId: string) => void;
  isUnlocking?: boolean;
}) {
  if (match.provider_match_id == null) {
    return null;
  }
  if (!match.locked) {
    return (
      <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">
        <span className="px-1.5 py-0.5 rounded bg-slate-800">Automático</span>
      </div>
    );
  }
  return (
    <div className="mt-1 flex items-center gap-2 text-[11px]">
      <span className="px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300">Corrigido</span>
      <button
        onClick={() => onUnlock(match.id)}
        disabled={isUnlocking}
        className="text-[var(--color-primary)] disabled:opacity-50"
      >
        Voltar ao automático
      </button>
    </div>
  );
}
