import { Link, useLocation, useSearchParams } from 'react-router-dom';

const BOLAO_PATHS = ['/', '/hall-dos-campeoes'];
const RODADA_PATHS = ['/rodada', '/parciais', '/ver-palpites'];

export function BottomNav() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const rodada = searchParams.get('rodada');

  function withRodada(to: string) {
    return rodada ? `${to}?rodada=${rodada}` : to;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-nav border-t border-card safe-area-pb pt-2.5">
      <div className="flex items-center justify-between px-6 max-w-2xl mx-auto">
        <NavTab label="Bolão" to={withRodada('/')} active={BOLAO_PATHS.includes(pathname)} />

        <Link
          to={withRodada('/palpites')}
          className="flex items-center justify-center h-[54px] px-[22px] rounded-full bg-primary text-on-primary text-sm font-extrabold shadow-[0_8px_24px_rgba(0,166,81,0.35)]"
        >
          Palpitar
        </Link>

        <NavTab label="Rodada" to={withRodada('/rodada')} active={RODADA_PATHS.includes(pathname)} />
      </div>
    </nav>
  );
}

function NavTab({ label, to, active }: { label: string; to: string; active: boolean }) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className="flex flex-col items-center justify-center gap-1.5 w-[84px] min-h-[44px]"
    >
      <span
        className={`w-[18px] h-[3px] rounded-sm ${active ? 'bg-primary' : 'bg-transparent'}`}
      />
      <span
        className={`text-xs ${active ? 'font-bold text-primary' : 'font-semibold text-text-muted'}`}
      >
        {label}
      </span>
    </Link>
  );
}
