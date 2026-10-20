import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePendingResults } from '../../features/matches/hooks/useMatches';
import { useAuth } from '../hooks/useAuth';
import { Avatar } from './Avatar';

const itemClass =
  'flex items-center justify-between w-full px-4 py-2.5 text-sm text-left hover:bg-primary/10 focus:bg-primary/10 outline-none';

export function ProfileMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { isAdmin, logout } = useAuth();
  const { data: pending } = usePendingResults();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Meu perfil"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="block rounded-full"
      >
        <Avatar name={name} size={32} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-44 py-1 rounded-xl bg-card border border-primary/20 shadow-lg z-20"
        >
          <Link role="menuitem" to="/meus-boloes" onClick={close} className={itemClass}>
            Meus bolões
          </Link>
          <Link role="menuitem" to="/perfil" onClick={close} className={itemClass}>
            Perfil
          </Link>
          {isAdmin() && (
            <Link role="menuitem" to="/admin" onClick={close} className={itemClass}>
              Admin
              {pending !== undefined && pending > 0 && (
                <span className="ml-2 min-w-5 px-1.5 rounded-full bg-primary text-bg text-xs font-bold text-center">
                  {pending}
                </span>
              )}
            </Link>
          )}
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              close();
              logout();
              navigate('/login');
            }}
            className={itemClass}
          >
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
