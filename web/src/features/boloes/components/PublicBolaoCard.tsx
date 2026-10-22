import type { PublicBolao } from '../api/publicBoloesApi';

interface PublicBolaoCardProps {
  bolao: PublicBolao;
  joining: boolean;
  onJoin: (id: string) => void;
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /^[\p{Lu}\p{N}]/u.test(w));
  return words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export function PublicBolaoCard({ bolao, joining, onJoin }: PublicBolaoCardProps) {
  const full = bolao.max_members > 0 && bolao.member_count >= bolao.max_members;
  const detail = `${bolao.member_count} de ${bolao.max_members} participantes${bolao.requires_approval ? ' · aprovação do dono' : ''}`;
  const label = bolao.requires_approval ? `Pedir para entrar no ${bolao.name}` : `Entrar no ${bolao.name}`;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card">
      <span
        aria-hidden="true"
        className="w-10 h-10 shrink-0 rounded-xl bg-primary/20 text-primary flex items-center justify-center text-sm font-extrabold"
      >
        {initials(bolao.name)}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-bold truncate">{bolao.name}</p>
        <p className="text-sm text-text-muted">{detail}</p>
      </div>
      {full ? (
        <span className="shrink-0 text-sm font-bold text-text-muted">Lotado</span>
      ) : (
        <button
          type="button"
          aria-label={label}
          disabled={joining}
          onClick={() => onJoin(bolao.id)}
          className={`shrink-0 h-9 px-4 rounded-full text-sm font-extrabold disabled:opacity-50 ${
            bolao.requires_approval ? 'border border-slate-600 text-text' : 'bg-primary text-on-primary'
          }`}
        >
          {bolao.requires_approval ? 'Pedir' : 'Entrar'}
        </button>
      )}
    </div>
  );
}
