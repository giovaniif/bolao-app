import { teamBadge } from '../teams/teamBadges';

interface TeamBadgeProps {
  team: string;
  size?: number;
}

export function TeamBadge({ team, size = 40 }: TeamBadgeProps) {
  const badge = teamBadge(team);
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        backgroundColor: badge.fill,
        border: `${Math.max(2, Math.round(size * 0.08))}px solid ${badge.ring}`,
        color: badge.text,
        fontSize: Math.round(size * (badge.initials.length > 2 ? 0.28 : 0.34)),
      }}
      className="shrink-0 rounded-full flex items-center justify-center font-extrabold"
    >
      {badge.initials}
    </span>
  );
}
