import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import { appleServiceId, googleClientId, requestAppleIdToken } from '../api/socialProviders';
import { useSocialSignIn } from '../hooks/useSocialSignIn';
import { GoogleButton } from './GoogleButton';
import { UsernameOnboarding } from './UsernameOnboarding';
import { TeamOnboarding } from './TeamOnboarding';

interface SocialSignInProps {
  next: string;
}

export function SocialSignIn({ next }: SocialSignInProps) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [providerError, setProviderError] = useState('');
  const [choosingTeam, setChoosingTeam] = useState(false);
  const social = useSocialSignIn((res, isNewAccount) => {
    login(res.token, { id: res.user_id, username: res.username, is_admin: res.is_admin, must_change_password: res.must_change_password });
    if (isNewAccount) setChoosingTeam(true);
    else navigate(next);
  });
  const apple = appleServiceId() !== '';
  const google = googleClientId() !== '';

  if (!apple && !google) return null;

  if (choosingTeam) {
    return <TeamOnboarding onDone={() => navigate(next)} />;
  }

  if (social.pending) {
    return (
      <UsernameOnboarding
        suggested={social.pending.suggested}
        loading={social.loading}
        error={social.error}
        onSubmit={social.chooseUsername}
      />
    );
  }

  async function handleApple() {
    setProviderError('');
    try {
      const identity = await requestAppleIdToken();
      social.signIn('apple', identity.idToken, identity.name);
    } catch (err) {
      const code =
        err !== null && typeof err === 'object' && 'error' in err ? String((err as { error: unknown }).error) : '';
      if (!/popup_closed|user_cancel/i.test(code)) {
        setProviderError('Não foi possível entrar com a Apple. Tente novamente.');
      }
    }
  }

  const error = social.error || providerError;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
        <span className="h-px flex-1 bg-slate-700" />
        ou
        <span className="h-px flex-1 bg-slate-700" />
      </div>
      {apple && (
        <button
          type="button"
          onClick={handleApple}
          disabled={social.loading}
          className="w-full h-11 rounded-full bg-white text-black font-medium flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <svg aria-hidden="true" viewBox="0 0 17 20" className="h-4 w-4" fill="currentColor">
            <path d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9C3.6 4.8 2 5.8 1.1 7.4c-1.9 3.2-.5 8 1.3 10.6.9 1.3 1.9 2.7 3.3 2.6 1.3-.1 1.8-.9 3.4-.9s2 .9 3.4.8c1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.9-1.1-3-4.3zM11.5 3c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z" />
          </svg>
          Continuar com a Apple
        </button>
      )}
      {google && <GoogleButton onToken={(token) => social.signIn('google', token)} onError={setProviderError} />}
      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
    </div>
  );
}
