import { Link } from 'react-router-dom';
import { Layout } from '../../../shared/components/Layout';
import { useExploreBoloes } from '../hooks/usePublicBoloes';
import { ExploreBoloes } from '../components/ExploreBoloes';

const actionClass = 'flex-1 flex items-center justify-center h-12 rounded-full text-sm font-extrabold';

export function ExplorePage() {
  const explore = useExploreBoloes();
  return (
    <Layout title="Explorar">
      <div className="space-y-4">
        <div className="rounded-2xl p-4 bg-card bg-gradient-to-br from-primary/20 to-transparent space-y-1">
          <h2 className="text-lg font-bold">Escolha um bolão para jogar</h2>
          <p className="text-sm text-text-muted">Entre num bolão aberto, use o código de um amigo ou crie o seu.</p>
        </div>
        <ExploreBoloes
          query={explore.query}
          onQueryChange={explore.setQuery}
          boloes={explore.boloes}
          isLoading={explore.isLoading}
          joiningId={explore.joiningId}
          onJoin={explore.join}
          requested={explore.requested}
          error={explore.error}
        />
        <div className="flex gap-2">
          <Link to="/entrar" className={`${actionClass} bg-card border border-slate-600`}>
            Tenho um código
          </Link>
          <Link to="/criar-bolao" className={`${actionClass} bg-primary text-on-primary`}>
            Criar bolão
          </Link>
        </div>
      </div>
    </Layout>
  );
}
