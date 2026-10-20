import { useState } from 'react';
import { Text, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteAccount } from '../api/auth';
import { useAuth } from './AuthProvider';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme';

export function DeleteAccount() {
  const [confirming, setConfirming] = useState(false);
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: deleteAccount,
    onSuccess: async () => {
      queryClient.clear();
      await signOut();
    },
  });

  if (!confirming) {
    return <PrimaryButton title="Excluir minha conta" variant="secondary" onPress={() => setConfirming(true)} />;
  }
  return (
    <View style={{ gap: 10, borderWidth: 1, borderColor: colors.danger, borderRadius: 12, padding: 14 }}>
      <Text style={{ color: colors.text }}>
        Sua conta, seus dados de acesso e seus pedidos saem de todos os bolões. Isso não pode ser desfeito.
      </Text>
      {remove.error && <Text style={{ color: colors.danger }}>{remove.error.message}</Text>}
      <PrimaryButton title="Cancelar" variant="secondary" onPress={() => setConfirming(false)} />
      <PrimaryButton title="Sim, excluir" onPress={() => remove.mutate()} loading={remove.isPending} />
    </View>
  );
}
