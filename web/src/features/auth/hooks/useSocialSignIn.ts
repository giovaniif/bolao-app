import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { needsUsername, socialLogin } from '../api/authApi';
import type { LoginResponse, SocialProvider } from '../api/authApi';

interface PendingIdentity {
  provider: SocialProvider;
  idToken: string;
}

interface SocialSignInVars extends PendingIdentity {
  username?: string;
}

export function useSocialSignIn(onSignedIn: (res: LoginResponse) => void) {
  const [pending, setPending] = useState<PendingIdentity | null>(null);
  const mutation = useMutation({
    mutationFn: ({ provider, idToken, username }: SocialSignInVars) => socialLogin(provider, idToken, username),
    onSuccess: (res) => {
      setPending(null);
      onSignedIn(res);
    },
    onError: (err, vars) => {
      if (needsUsername(err)) setPending({ provider: vars.provider, idToken: vars.idToken });
    },
  });

  const error = mutation.error && !needsUsername(mutation.error) ? mutation.error.message : '';

  return {
    pending,
    error,
    loading: mutation.isPending,
    signIn: (provider: SocialProvider, idToken: string) => mutation.mutate({ provider, idToken }),
    chooseUsername: (username: string) => {
      if (pending) mutation.mutate({ ...pending, username });
    },
  };
}
