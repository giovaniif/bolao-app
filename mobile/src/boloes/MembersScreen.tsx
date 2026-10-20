import { ScrollView, Share, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createInviteLink, getInviteCode, getMembers, reviewRequest } from '../api/boloes';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme';
import { track } from '../analytics/analytics';

const INVITE_HOST = process.env.EXPO_PUBLIC_INVITE_URL ?? 'https://bolao-app-dev.vercel.app';

export function MembersScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const members = useQuery({ queryKey: ['members', id], queryFn: () => getMembers(id), enabled: !!id });
  const code = useQuery({ queryKey: ['invite', id], queryFn: () => getInviteCode(id), enabled: !!id });
  const review = useMutation({
    mutationFn: ({ userId, decision }: { userId: string; decision: 'approve' | 'reject' }) => reviewRequest(id, userId, decision),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members', id] }),
  });
  const link = useMutation({
    mutationFn: () => createInviteLink(id),
    onSuccess: async (res) => {
      track('invite_link_created');
      await Share.share({ message: `Entra no meu bolão: ${INVITE_HOST}/convite/${res.token}` });
    },
  });
  const pending = (members.data ?? []).filter((m) => m.status === 'pending');
  const active = (members.data ?? []).filter((m) => m.status === 'active');

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 16, gap: 10 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Código do bolão</Text>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: 4 }}>{code.data?.code ?? '········'}</Text>
        <PrimaryButton title="Compartilhar link de convite" onPress={() => link.mutate()} loading={link.isPending} />
        <Text style={{ color: colors.muted, fontSize: 12 }}>O link entra direto, sem aprovação, e vale por 7 dias.</Text>
      </View>
      {pending.length > 0 && <Text style={{ color: colors.muted, fontWeight: '800', marginTop: 8 }}>PEDIDOS PARA ENTRAR</Text>}
      {pending.map((m) => (
        <View key={m.id} style={{ backgroundColor: colors.card, borderRadius: 12, padding: 12, gap: 10, borderWidth: 1, borderColor: '#a16207' }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{m.display_name}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton title={`Recusar ${m.display_name}`} variant="secondary" onPress={() => review.mutate({ userId: m.id, decision: 'reject' })} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton title={`Aprovar ${m.display_name}`} onPress={() => review.mutate({ userId: m.id, decision: 'approve' })} />
            </View>
          </View>
        </View>
      ))}
      <Text style={{ color: colors.muted, fontWeight: '800', marginTop: 8 }}>{active.length} PARTICIPANTES</Text>
      {active.map((m) => (
        <View key={m.id} style={{ backgroundColor: colors.card, borderRadius: 12, padding: 12 }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{m.display_name}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>@{m.username}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
