import { Link } from 'react-router-dom';
import { Layout } from '../../../shared/components/Layout';
import { useMyBoloes } from '../../../shared/hooks/useCurrentBolao';
import { MyBolaoCard } from '../components/MyBolaoCard';

const actionClass =
  'flex-1 flex items-center justify-center text-center px-4 py-2.5 rounded-lg text-sm font-semibold';

export function MyBoloesPage() {
  const { data: boloes = [], isLoading } = useMyBoloes();
  const active = boloes.filter((b) => b.status === 'active');
  const finished = boloes.filter((b) => b.status !== 'active' && b.member_status === 'active');

  return (
    <Layout title="Meus bolões">
      <div className="space-y-5">
        <div className="flex gap-2">
          <Link to="/criar-bolao" className={`${actionClass} bg-primary text-on-primary`}>
            Criar bolão
          </Link>
          <Link to="/entrar" className={`${actionClass} bg-card border border-slate-600`}>
            Entrar com código
          </Link>
        </div>

        {!isLoading && boloes.length === 0 && (
          <p className="text-sm text-text-muted text-center py-8">Você ainda não participa de nenhum bolão.</p>
        )}

        {active.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Em andamento</h2>
            {active.map((b) => (
              <MyBolaoCard key={b.id} bolao={b} />
            ))}
          </section>
        )}

        {finished.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Encerrados</h2>
            {finished.map((b) => (
              <MyBolaoCard key={b.id} bolao={b} />
            ))}
          </section>
        )}
      </div>
    </Layout>
  );
}
