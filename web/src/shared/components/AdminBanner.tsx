import { Link, useLocation } from 'react-router-dom';
import { usePendingResults } from '../../features/matches/hooks/useMatches';
import { useAuth } from '../hooks/useAuth';

/**
 * Replaces the permanent Admin tab. The count rides on the rounds summary every screen
 * already fetches, so the banner costs no extra request.
 */
export function AdminBanner() {
  const { isAdmin } = useAuth();
  const { pathname } = useLocation();
  const { data: pending } = usePendingResults();

  if (!isAdmin() || pathname === '/admin') return null;

  // Loading, errored or zero all render the bare label: "0 resultados" is noise.
  const label =
    pending && pending > 0
      ? `Modo admin · ${pending} ${pending === 1 ? 'resultado' : 'resultados'} por lançar`
      : 'Modo admin';

  // The banner owns its spacing so that hiding it leaves nothing behind.
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-3 mx-5 mt-3.5 px-3.5 py-2.5 rounded-xl bg-primary/10 border border-primary/35">
        <span className="text-xs font-semibold text-emerald-100">{label}</span>
        <Link to="/admin" className="text-xs font-bold text-primary shrink-0">
          Abrir
        </Link>
      </div>
    </div>
  );
}
