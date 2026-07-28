import { Link } from 'react-router-dom';
import { useProfile } from '../../features/profile/hooks/useProfile';
import { useAuth } from '../hooks/useAuth';
import { Avatar } from './Avatar';

/** Wordmark on the left, profile avatar on the right. Nothing else. */
export function AppHeader({ title }: { title?: string }) {
  const { data: profile } = useProfile();
  const { user } = useAuth();
  // The auth User has no display_name; the username holds the avatar until /me lands so
  // the initials do not pop in late.
  const name = profile?.display_name ?? user?.username ?? '';

  return (
    <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-card">
      <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
        <Link to="/" className="font-extrabold text-lg text-primary">
          Bolão
        </Link>
        <Link to="/perfil" aria-label="Meu perfil">
          <Avatar name={name} size={32} />
        </Link>
      </div>
      {title && (
        <div className="px-4 pb-2">
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>
      )}
    </header>
  );
}
