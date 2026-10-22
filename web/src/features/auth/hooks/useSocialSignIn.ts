import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { needsUsername, socialLogin, suggestedUsername } from '../api/authApi';
import type { LoginResponse, SocialProvider } from '../api/authApi';

interface Identity {
  provider: SocialProvider;
  idToken: string;
  name?: string;
}

interface PendingIdentity extends Identity {
  suggested: string;
}

interface SocialSignInVars extends Identity {
  username?: string;
}

export function useSocialSignIn(onSignedIn: (res: LoginResponse, isNewAccount: boolean) => void) {
  const [pending, setPending] = useState<PendingIdentity | null>(null);
  const mutation = useMutation({
    mutationFn: ({ provider, idToken, username, name }: SocialSignInVars) =>
      socialLogin(provider, idToken, { username, name }),
    onSuccess: (res, vars) => {
      setPending(null);
      onSignedIn(res, vars.username !== undefined);
    },
    onError: (err, vars) => {
      if (needsUsername(err)) {
        setPending({ provider: vars.provider, idToken: vars.idToken, name: vars.name, suggested: suggestedUsername(err) });
      }
    },
  });

  const error = mutation.error && !needsUsername(mutation.error) ? mutation.error.message : '';

  return {
    pending,
    error,
    loading: mutation.isPending,
    signIn: (provider: SocialProvider, idToken: string, name?: string) =>
      mutation.mutate({ provider, idToken, name: name || undefined }),
    chooseUsername: (username: string) => {
      if (pending) mutation.mutate({ provider: pending.provider, idToken: pending.idToken, name: pending.name, username });
    },
  };
}
