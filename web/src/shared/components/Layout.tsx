import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from './Button';
import { BottomNav } from './BottomNav';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

export function Layout({ children, title }: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  // pb-28 clears the new bar, which is about 96px tall with the centre pill.
  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-10 bg-[var(--color-bg)]/95 backdrop-blur border-b border-slate-700">
        <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
          <Link to="/" className="font-bold text-[var(--color-primary)]">
            Bolão
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/hall-dos-campeoes"
              aria-label="Hall dos Campeões"
              title="Hall dos Campeões"
              className="text-lg leading-none hover:opacity-80"
            >
              🏆
            </Link>
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

      <BottomNav />
    </div>
  );
}
