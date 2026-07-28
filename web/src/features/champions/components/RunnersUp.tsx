import type { UserWithStats } from '../../classification/api/classificationApi';

interface RunnersUpProps {
  runnerUp?: UserWithStats;
  third?: UserWithStats;
}

/** 2nd and 3rd side by side. Rank is carried by colour and label, not emoji. */
export function RunnersUp({ runnerUp, third }: RunnersUpProps) {
  if (!runnerUp) return null;

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Place label="2º LUGAR" user={runnerUp} accent="border-t-slate-300 text-slate-300" />
      {third && <Place label="3º LUGAR" user={third} accent="border-t-amber-700 text-amber-700" />}
    </div>
  );
}

function Place({ label, user, accent }: { label: string; user: UserWithStats; accent: string }) {
  const [border, text] = accent.split(' ');
  return (
    <div className={`flex flex-col gap-1.5 p-3.5 rounded-2xl bg-card border-t-[3px] ${border}`}>
      <span className={`text-[11px] font-bold tracking-[0.1em] ${text}`}>{label}</span>
      <p className="text-[15px] font-bold truncate">{user.display_name}</p>
      <p className="text-xs text-text-muted truncate">
        {user.total_points} pts{user.favorite_team ? ` · ${user.favorite_team}` : ''}
      </p>
    </div>
  );
}
