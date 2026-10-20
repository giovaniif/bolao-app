import { Link } from 'react-router-dom';
import { useProfile } from '../../features/profile/hooks/useProfile';
import { useAuth } from '../hooks/useAuth';
import { ProfileMenu } from './ProfileMenu';
import { BolaoSwitcher } from './BolaoSwitcher';
import { useCurrentBolao } from '../hooks/useCurrentBolao';

export function AppHeader({ title }: { title?: string }) {
  const { data: profile } = useProfile();
  const { user } = useAuth();
  const name = profile?.display_name ?? user?.username ?? '';
  const { bolao, boloes, select } = useCurrentBolao();

  return (
    <header className="sticky top-0 z-10 safe-area-pt bg-bg/95 backdrop-blur border-b border-card">
      <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="font-extrabold text-lg text-primary shrink-0">
            Bolão
          </Link>
          <BolaoSwitcher boloes={boloes} current={bolao} onSelect={select} />
        </div>
        <ProfileMenu name={name} />
      </div>
      {title && (
        <div className="px-4 pb-2">
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>
      )}
    </header>
  );
}
