import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { changePassword } from '../api/auth';
import { PrimaryButton } from '../components/PrimaryButton';
import { TextField } from '../components/TextField';
import { colors } from '../theme';

export function ChangePasswordScreen() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const mutation = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: () => router.replace('/'),
  });

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
      <TextField label="Senha atual" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" />
      <TextField label="Nova senha" value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" />
      <TextField label="Confirmar nova senha" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" />
      {mismatch && <Text style={{ color: colors.danger }}>As senhas não conferem.</Text>}
      {mutation.error && <Text style={{ color: colors.danger }}>{mutation.error.message}</Text>}
      <PrimaryButton
        title="Alterar senha"
        loading={mutation.isPending}
        disabled={!current || !next}
        onPress={() => {
          const differs = next !== confirm;
          setMismatch(differs);
          if (!differs) {
            mutation.mutate();
          }
        }}
      />
    </ScrollView>
  );
}
