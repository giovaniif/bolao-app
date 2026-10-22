import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as AppleAuthentication from 'expo-apple-authentication';
import { needsUsername, socialLogin, suggestedUsername, type SocialProvider } from '../api/auth';
import { useAuth } from './AuthProvider';
import { appleAvailable, appleIdToken, googleAvailable, googleIdToken, type ProviderCredential } from './socialProviders';
import { setPendingSignup } from '../onboarding/pendingSignup';
import { deriveUsername } from '../onboarding/deriveUsername';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme';

interface Attempt {
  provider: SocialProvider;
  idToken: string;
  name?: string;
}

export function SocialSignIn({ next }: { next: string }) {
  const { signIn } = useAuth();
  const router = useRouter();
  const [providerError, setProviderError] = useState('');
  const apple = useQuery({ queryKey: ['apple-sign-in-available'], queryFn: appleAvailable, staleTime: Infinity });
  const google = googleAvailable();

  const mutation = useMutation({
    mutationFn: (attempt: Attempt) => socialLogin(attempt.provider, attempt.idToken),
    onSuccess: async (res) => {
      await signIn(res);
      router.replace(next);
    },
    onError: (err, attempt) => {
      if (!needsUsername(err)) return;
      setPendingSignup({ ...attempt, suggestedUsername: suggestedUsername(err) || deriveUsername(attempt.name ?? ''), next });
      router.push('/boas-vindas');
    },
  });

  async function start(provider: SocialProvider, getCredential: () => Promise<ProviderCredential | null>) {
    setProviderError('');
    try {
      const credential = await getCredential();
      if (credential) mutation.mutate({ provider, ...credential });
    } catch (err) {
      setProviderError(err instanceof Error ? err.message : 'Não foi possível entrar. Tente de novo.');
    }
  }

  const error = (mutation.error && !needsUsername(mutation.error) ? mutation.error.message : '') || providerError;

  if (!apple.data && !google) return null;

  return (
    <View style={{ gap: 12, marginTop: 8 }}>
      <Text style={{ color: colors.muted, textAlign: 'center' }}>ou</Text>
      {apple.data && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={12}
          style={{ height: 48 }}
          onPress={() => start('apple', appleIdToken)}
        />
      )}
      {google && (
        <PrimaryButton title="Continuar com o Google" variant="secondary" onPress={() => start('google', googleIdToken)} loading={mutation.isPending} />
      )}
      {error !== '' && <Text style={{ color: colors.danger }}>{error}</Text>}
    </View>
  );
}
