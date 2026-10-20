import { Link } from 'react-router-dom';
import type { MyBolao } from '../../../shared/api/myBoloesApi';

const ROLE_LABEL: Record<MyBolao['role'], string> = {
  owner: 'Dono',
  admin: 'Admin',
  participant: 'Participante',
};

export function MyBolaoCard({ bolao }: { bolao: MyBolao }) {
  const body = (
    <>
      <div className="min-w-0">
        <p className="font-semibold truncate">{bolao.name}</p>
        <p className="text-xs text-text-muted">{bolao.member_count} participantes</p>
      </div>
      {bolao.member_status === 'pending' ? (
        <span className="shrink-0 text-xs font-semibold text-accent">Aguardando aprovação</span>
      ) : (
        <span className="shrink-0 text-xs font-semibold text-text-muted">{ROLE_LABEL[bolao.role]}</span>
      )}
    </>
  );
  const className = 'flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-card border border-slate-700';
  if (bolao.member_status === 'pending') {
    return <div className={`${className} opacity-80`}>{body}</div>;
  }
  return (
    <Link to={`/?bolao=${bolao.id}`} className={`${className} hover:border-primary/60`}>
      {body}
    </Link>
  );
}
