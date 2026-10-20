import { Layout } from '../../../shared/components/Layout';
import { Button } from '../../../shared/components/Button';
import { useCurrentBolao } from '../../../shared/hooks/useCurrentBolao';
import { useCreateInviteLink, useInviteCode, useMemberActions, useMembers } from '../hooks/useMembers';
import { InviteCard } from '../components/InviteCard';
import type { MemberRole } from '../api/membersApi';

const ROLE_LABEL: Record<MemberRole, string> = { owner: 'Dono', admin: 'Admin', participant: 'Participante' };

export function MembersPage() {
  const { bolao } = useCurrentBolao();
  const myRole = bolao?.role ?? 'participant';
  const manages = myRole === 'owner' || myRole === 'admin';
  const { data: members = [] } = useMembers(bolao?.id);
  const { data: invite } = useInviteCode(bolao?.id, manages);
  const link = useCreateInviteLink(bolao?.id);
  const actions = useMemberActions(bolao?.id);
  const pending = members.filter((m) => m.status === 'pending');
  const active = members.filter((m) => m.status === 'active');
  const linkUrl = link.data ? `${window.location.origin}/convite/${link.data.token}` : undefined;

  return (
    <Layout title={bolao ? `Participantes · ${bolao.name}` : 'Participantes'}>
      <div className="space-y-5">
        {manages && (
          <InviteCard code={invite?.code} link={linkUrl} onCreateLink={() => link.mutate()} creating={link.isPending} />
        )}

        {manages && pending.length > 0 && (
          <section aria-label="Pedidos para entrar" className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Pedidos para entrar</h2>
            {pending.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-card border border-accent/40">
                <span className="truncate">{m.display_name}</span>
                <div className="flex gap-2 shrink-0">
                  <Button variant="secondary" className="text-sm" aria-label={`Recusar ${m.display_name}`} onClick={() => actions.review.mutate({ userId: m.id, decision: 'reject' })}>
                    Recusar
                  </Button>
                  <Button className="text-sm" aria-label={`Aprovar ${m.display_name}`} onClick={() => actions.review.mutate({ userId: m.id, decision: 'approve' })}>
                    Aprovar
                  </Button>
                </div>
              </div>
            ))}
          </section>
        )}

        <section aria-label="Participantes" className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{active.length} participantes</h2>
          {active.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-card">
              <div className="min-w-0">
                <p className="truncate">{m.display_name}</p>
                <p className="text-xs text-text-muted">@{m.username}</p>
              </div>
              {myRole === 'owner' && m.role !== 'owner' ? (
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    aria-label={`Papel de ${m.display_name}`}
                    value={m.role}
                    onChange={(e) => actions.setRole.mutate({ userId: m.id, role: e.target.value as MemberRole })}
                    className="px-2 py-1 rounded bg-bg border border-slate-600 text-sm"
                  >
                    <option value="participant">Participante</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button aria-label={`Remover ${m.display_name}`} onClick={() => actions.remove.mutate(m.id)} className="text-red-400 text-sm px-1">
                    Remover
                  </button>
                </div>
              ) : (
                <span className="text-xs font-semibold text-text-muted shrink-0">{ROLE_LABEL[m.role]}</span>
              )}
            </div>
          ))}
        </section>
      </div>
    </Layout>
  );
}
