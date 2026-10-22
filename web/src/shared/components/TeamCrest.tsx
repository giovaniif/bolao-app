import { useState } from 'react';
import { crestUrl, teamInitials } from '../teams/teamCrests';

interface TeamCrestProps {
  team: string;
  size?: number;
}

export function TeamCrest({ team, size = 40 }: TeamCrestProps) {
  const [failed, setFailed] = useState(false);
  const src = crestUrl(team);
  const style = { width: size, height: size };

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={`Escudo do ${team}`}
        style={style}
        className="shrink-0 object-contain"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={style}
      className="shrink-0 rounded-full bg-slate-700 text-white flex items-center justify-center font-mono text-[10px] font-extrabold"
    >
      {teamInitials(team)}
    </span>
  );
}
