import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteAccount, getDeletionBlockers, type DeletionBlocker } from '../api/auth';
import { ACCOUNT_DELETED } from '../api/session';
import { useAuth } from './AuthProvider';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme';

function OwnerPicker({ blocker, value, onChange }: { blocker: DeletionBlocker; value: string; onChange: (userId: string) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{`Quem fica como dono de ${blocker.bolao_name}?`}</Text>
      {blocker.members.map((m) => {
        const checked = m.user_id === value;
        return (
          <Pressable
            key={m.user_id}
            accessibilityRole="radio"
            accessibilityLabel={m.display_name}
            accessibilityState={{ checked }}
            onPress={() => onChange(m.user_id)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 12, borderRadius: 10, backgroundColor: checked ? 'rgba(0,166,81,0.2)' : colors.card }}
          >
            <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: checked ? colors.primary : colors.muted, backgroundColor: checked ? colors.primary : 'transparent' }} />
            <Text style={{ color: colors.text, flex: 1 }}>{m.display_name}</Text>
            {m.role === 'admin' && <Text style={{ color: colors.muted, fontSize: 12 }}>admin</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

export function DeleteAccount() {
  const [confirming, setConfirming] = useState(false);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const check = useQuery({ queryKey: ['deletion-check'], queryFn: getDeletionBlockers, enabled: confirming });
  const blockers = check.data ?? [];
  const newOwners = Object.fromEntries(blockers.map((b) => [b.bolao_id, chosen[b.bolao_id] ?? b.suggested_owner_id]));
  const remove = useMutation({
    mutationFn: () => deleteAccount(newOwners),
    onSuccess: async () => {
      queryClient.clear();
      await signOut(ACCOUNT_DELETED);
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
      {check.isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : check.error ? (
        <Text style={{ color: colors.danger }}>{check.error.message}</Text>
      ) : (
        <>
          {blockers.map((b) => (
            <OwnerPicker key={b.bolao_id} blocker={b} value={newOwners[b.bolao_id]} onChange={(userId) => setChosen({ ...chosen, [b.bolao_id]: userId })} />
          ))}
          {remove.error && <Text style={{ color: colors.danger }}>{remove.error.message}</Text>}
          <PrimaryButton title="Cancelar" variant="secondary" onPress={() => setConfirming(false)} />
          <PrimaryButton title="Sim, excluir" onPress={() => remove.mutate()} loading={remove.isPending} />
        </>
      )}
    </View>
  );
}
