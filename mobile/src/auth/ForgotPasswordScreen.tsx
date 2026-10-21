import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { Link } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { forgotPassword } from '../api/auth';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme';

export function ForgotPasswordScreen() {
  const [login, setLogin] = useState('');
  const mutation = useMutation({ mutationFn: () => forgotPassword(login.trim()) });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
        {mutation.isSuccess ? (
          <Text style={{ color: colors.muted, textAlign: 'center' }}>
            Se existir uma conta com e-mail para esse login, enviamos um link para criar uma nova senha. Ele vale por 1 hora.
          </Text>
        ) : (
          <>
            <Text style={{ color: colors.muted, textAlign: 'center' }}>
              Informe seu usuário ou e-mail. Enviaremos um link para o e-mail da conta.
            </Text>
            <TextField label="Usuário ou e-mail" value={login} onChangeText={setLogin} autoCapitalize="none" autoCorrect={false} textContentType="username" />
            {mutation.error && <Text style={{ color: colors.danger }}>{mutation.error.message}</Text>}
            <PrimaryButton title="Enviar link" onPress={() => mutation.mutate()} disabled={!login.trim()} loading={mutation.isPending} />
          </>
        )}
        <Link href="/login" style={{ color: colors.primary, textAlign: 'center', fontWeight: '700', marginTop: 8 }}>
          Voltar para o login
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
