import type { PublicBolao } from '../api/publicBoloesApi';
import { PublicBolaoCard } from './PublicBolaoCard';

interface ExploreBoloesProps {
  query: string;
  onQueryChange: (query: string) => void;
  boloes: PublicBolao[];
  isLoading: boolean;
  joiningId?: string;
  onJoin: (id: string) => void;
  requested: boolean;
  error: string;
}

export function ExploreBoloes({
  query,
  onQueryChange,
  boloes,
  isLoading,
  joiningId,
  onJoin,
  requested,
  error,
}: ExploreBoloesProps) {
  const searching = query.trim() !== '';
  return (
    <div className="space-y-3">
      <input
        type="search"
        aria-label="Buscar bolões"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Buscar bolões pelo nome"
        className="w-full h-11 px-4 rounded-full bg-card text-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">
        {searching ? `${boloes.length} ${boloes.length === 1 ? 'resultado' : 'resultados'}` : 'Bolões abertos'}
      </h2>
      {requested && (
        <p role="status" className="text-sm text-primary">
          Pedido enviado. Você entra quando o dono aprovar.
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!isLoading && boloes.length === 0 && (
        <p className="text-sm text-text-muted text-center py-4">Nenhum bolão aberto encontrado.</p>
      )}
      {boloes.map((b) => (
        <PublicBolaoCard key={b.id} bolao={b} joining={joiningId === b.id} onJoin={onJoin} />
      ))}
      <p className="text-sm text-text-muted text-center pt-2">
        Bolões privados não aparecem na busca. Peça o código ou o link ao dono.
      </p>
    </div>
  );
}
