import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { returnTo } from './returnTo';
import { useMutation } from '@tanstack/react-query';
import { signup } from '../api/auth';
import { useAuth } from './AuthProvider';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme';
import { SocialSignIn } from './SocialSignIn';
import { track } from '../analytics/analytics';

export function SignupScreen() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn } = useAuth();
  const router = useRouter();
  const { voltar } = useLocalSearchParams<{ voltar?: string }>();
  const ready = displayName.trim() !== '' && username.trim().length >= 3 && email.includes('@') && password.length >= 8;
  const mutation = useMutation({
    mutationFn: () =>
      signup({ username: username.trim().toLowerCase(), display_name: displayName.trim(), email: email.trim(), password }),
    onSuccess: async (res) => {
      await signIn(res);
      track('signed_up');
      router.replace(returnTo(voltar, '/meus-boloes'));
    },
  });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: colors.primary, fontSize: 28, fontWeight: '900', textAlign: 'center', marginBottom: 8 }}>Criar conta</Text>
        <TextField label="Seu nome" value={displayName} onChangeText={setDisplayName} textContentType="name" />
        <TextField label="Nome de usuário" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} placeholder="joao.silva" />
        <TextField label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" textContentType="emailAddress" />
        <TextField label="Senha" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" placeholder="Pelo menos 8 caracteres" />
        {mutation.error && <Text style={{ color: colors.danger }}>{mutation.error.message}</Text>}
        <PrimaryButton title="Criar conta" onPress={() => mutation.mutate()} disabled={!ready} loading={mutation.isPending} />
        <Link href="/login" style={{ color: colors.primary, textAlign: 'center', fontWeight: '700', marginTop: 8 }}>
          Já tem conta? Entrar
        </Link>
        <SocialSignIn next={returnTo(voltar, '/meus-boloes')} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
