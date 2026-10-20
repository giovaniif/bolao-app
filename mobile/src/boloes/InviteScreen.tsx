import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getInvitePreview, joinInvite } from '../api/boloes';
import { useAuth } from '../auth/AuthProvider';
import { bolaoKeys, useCurrentBolao } from '../bolao/useCurrentBolao';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme';
import { track } from '../analytics/analytics';

export function InviteScreen() {
  const { code = '' } = useLocalSearchParams<{ code: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { select } = useCurrentBolao();
  const preview = useQuery({ queryKey: ['invites', code], queryFn: () => getInvitePreview(code), retry: false });
  const join = useMutation({
    mutationFn: () => joinInvite(code),
    onSuccess: async (res) => {
      track(res.status === 'active' ? 'bolao_joined' : 'join_requested');
      await queryClient.invalidateQueries({ queryKey: bolaoKeys.mine });
      if (res.status === 'active') {
        await select(res.bolao_id);
        router.replace('/');
      }
    },
  });

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 16 }}>
      <Text style={{ color: colors.primary, fontWeight: '700', textAlign: 'center' }}>Você foi convidado para um bolão</Text>
      {preview.isLoading && <ActivityIndicator color={colors.primary} />}
      {preview.error && <Text style={{ color: colors.danger, textAlign: 'center' }}>Este convite não existe ou já expirou.</Text>}
      {preview.data && (
        <>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: '900', textAlign: 'center' }}>{preview.data.name}</Text>
          <Text style={{ color: colors.muted, textAlign: 'center' }}>
            {preview.data.member_count} de {preview.data.max_members} participantes
          </Text>
          {!token ? (
            <>
              <PrimaryButton title="Entrar para participar" onPress={() => router.push({ pathname: '/login', params: { voltar: `/convite/${code}` } })} />
              <PrimaryButton title="Criar conta" variant="secondary" onPress={() => router.push({ pathname: '/cadastro', params: { voltar: `/convite/${code}` } })} />
            </>
          ) : join.data?.status === 'pending' ? (
            <Text style={{ color: colors.accent, textAlign: 'center' }}>Pedido enviado. Você entra quando o dono aprovar.</Text>
          ) : (
            <PrimaryButton title={preview.data.joins === 'direct' ? 'Entrar no bolão' : 'Pedir para entrar'} onPress={() => join.mutate()} loading={join.isPending} />
          )}
          {join.error && <Text style={{ color: colors.danger, textAlign: 'center' }}>{join.error.message}</Text>}
        </>
      )}
    </View>
  );
}
