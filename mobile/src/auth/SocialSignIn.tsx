import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as AppleAuthentication from 'expo-apple-authentication';
import { needsUsername, socialLogin, type SocialProvider } from '../api/auth';
import { useAuth } from './AuthProvider';
import { appleAvailable, appleIdToken, googleAvailable, googleIdToken } from './socialProviders';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme';

interface Attempt {
  provider: SocialProvider;
  idToken: string;
  username?: string;
}

export function SocialSignIn({ next }: { next: string }) {
  const { signIn } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState<Attempt | null>(null);
  const [username, setUsername] = useState('');
  const [providerError, setProviderError] = useState('');
  const apple = useQuery({ queryKey: ['apple-sign-in-available'], queryFn: appleAvailable, staleTime: Infinity });
  const google = googleAvailable();

  const mutation = useMutation({
    mutationFn: (attempt: Attempt) => socialLogin(attempt.provider, attempt.idToken, attempt.username),
    onSuccess: async (res) => {
      await signIn(res);
      router.replace(next);
    },
    onError: (err, attempt) => {
      if (needsUsername(err)) setPending({ provider: attempt.provider, idToken: attempt.idToken });
    },
  });

  async function start(provider: SocialProvider, getToken: () => Promise<string | null>) {
    setProviderError('');
    try {
      const idToken = await getToken();
      if (idToken) mutation.mutate({ provider, idToken });
    } catch (err) {
      setProviderError(err instanceof Error ? err.message : 'Não foi possível entrar. Tente de novo.');
    }
  }

  const error = (mutation.error && !needsUsername(mutation.error) ? mutation.error.message : '') || providerError;

  if (pending) {
    return (
      <View style={{ gap: 16 }}>
        <Text style={{ color: colors.muted, textAlign: 'center' }}>Falta pouco: escolha como você vai aparecer no bolão.</Text>
        <TextField label="Nome de usuário" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} placeholder="joao.silva" />
        {error !== '' && <Text style={{ color: colors.danger }}>{error}</Text>}
        <PrimaryButton
          title="Criar conta"
          onPress={() => mutation.mutate({ ...pending, username: username.trim().toLowerCase() })}
          disabled={username.trim().length < 3}
          loading={mutation.isPending}
        />
      </View>
    );
  }

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
