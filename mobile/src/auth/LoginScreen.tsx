import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { returnTo } from './returnTo';
import { useMutation } from '@tanstack/react-query';
import { login } from '../api/auth';
import { useAuth } from './AuthProvider';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme';

export function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { signIn } = useAuth();
  const router = useRouter();
  const { voltar } = useLocalSearchParams<{ voltar?: string }>();
  const mutation = useMutation({
    mutationFn: () => login(username.trim(), password),
    onSuccess: async (res) => {
      await signIn(res);
      router.replace(res.must_change_password ? '/alterar-senha' : returnTo(voltar, '/'));
    },
  });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ color: colors.primary, fontSize: 32, fontWeight: '900' }}>Bolão</Text>
          <Text style={{ color: colors.muted, marginTop: 4 }}>Usuário e senha para acessar</Text>
        </View>
        <TextField label="Usuário" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} textContentType="username" />
        <TextField label="Senha" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" />
        <Link href="/esqueci-senha" style={{ color: colors.primary, textAlign: 'right' }}>
          Esqueci minha senha
        </Link>
        {mutation.error && <Text style={{ color: colors.danger }}>{mutation.error.message}</Text>}
        <PrimaryButton title="Entrar" onPress={() => mutation.mutate()} disabled={!username.trim() || !password} loading={mutation.isPending} />
        <Link href="/cadastro" style={{ color: colors.primary, textAlign: 'center', fontWeight: '700', marginTop: 8 }}>
          Ainda não tem conta? Criar conta
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
