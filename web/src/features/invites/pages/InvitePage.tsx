import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import { Button } from '../../../shared/components/Button';
import { useInvitePreview, useJoinInvite } from '../hooks/useInvite';

export function InvitePage() {
  const { code = '' } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const { data: preview, isLoading, error } = useInvitePreview(code);
  const join = useJoinInvite(code);

  async function handleJoin() {
    const result = await join.mutateAsync();
    if (result.status === 'active') {
      navigate(`/?bolao=${result.bolao_id}`);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 safe-area-pt">
      <div className="w-full max-w-sm space-y-6 text-center">
        <p className="text-sm font-semibold text-primary">Você foi convidado para um bolão</p>
        {isLoading && <p className="text-text-muted">Carregando convite…</p>}
        {error && <p className="text-red-400">Este convite não existe ou já expirou.</p>}
        {preview && (
          <>
            <div className="space-y-1">
              <h1 className="text-2xl font-extrabold">{preview.name}</h1>
              <p className="text-sm text-text-muted">
                {preview.member_count} de {preview.max_members} participantes
              </p>
            </div>
            <p className="text-sm text-text-muted">
              Palpite nos jogos de cada rodada. Os jogos e resultados entram sozinhos e a classificação sai na hora.
            </p>
            {!token ? (
              <Link
                to={`/login?voltar=${encodeURIComponent(`/convite/${code}`)}`}
                className="block w-full px-4 py-3 rounded-lg bg-primary text-on-primary font-semibold"
              >
                Entrar para participar
              </Link>
            ) : join.data?.status === 'pending' ? (
              <p className="text-sm text-accent">Pedido enviado. Você entra quando o dono aprovar.</p>
            ) : (
              <Button className="w-full py-3" disabled={join.isPending} onClick={handleJoin}>
                {preview.joins === 'direct' ? 'Entrar no bolão' : 'Pedir para entrar'}
              </Button>
            )}
            {join.error && <p className="text-sm text-red-400">{join.error.message}</p>}
          </>
        )}
      </div>
    </div>
  );
}
