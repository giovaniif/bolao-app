import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from './Button';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

export function Layout({ children, title }: LayoutProps) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-10 bg-[var(--color-bg)]/95 backdrop-blur border-b border-slate-700">
        <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
          <Link to="/" className="font-bold text-[var(--color-primary)]">
            Bolão
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/perfil"
              className="text-sm text-[var(--color-primary)] truncate max-w-[120px] hover:underline"
            >
              {user?.username}
            </Link>
            <Button variant="ghost" onClick={handleLogout} className="py-1 text-sm">
              Sair
            </Button>
          </div>
        </div>
        {title && (
          <div className="px-4 pb-2">
            <h1 className="text-lg font-semibold">{title}</h1>
          </div>
        )}
      </header>

      <main className="px-4 py-4 max-w-2xl mx-auto">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 bg-[var(--color-card)] border-t border-slate-700 safe-area-pb">
        <div className="flex justify-around py-2 max-w-2xl mx-auto">
          <NavLink to="/">Classificação</NavLink>
          <NavLink to="/palpites">Palpites</NavLink>
          <NavLink to="/ver-palpites">Ver palpites</NavLink>
          <NavLink to="/parciais">Parciais</NavLink>
          {isAdmin() && <NavLink to="/admin">Admin</NavLink>}
        </div>
      </nav>
    </div>
  );
}

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link
      to={to}
      className={`flex-1 py-2 text-center text-sm font-medium ${
        active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-primary)]'
      }`}
    >
      {children}
    </Link>
  );
}
