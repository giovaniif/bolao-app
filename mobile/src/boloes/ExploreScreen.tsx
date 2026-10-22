import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { joinPublicBolao, listPublicBoloes, type PublicBolao } from '../api/boloes';
import { bolaoKeys, useCurrentBolao } from '../bolao/useCurrentBolao';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme';
import { track } from '../analytics/analytics';

const SEARCH_DELAY_MS = 400;

function useDebounced(value: string) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [value]);
  return debounced;
}

function PublicBolaoRow({ bolao, requested, joining, onJoin }: { bolao: PublicBolao; requested: boolean; joining: boolean; onJoin: () => void }) {
  const full = bolao.member_count >= bolao.max_members;
  const action = bolao.requires_approval ? 'Pedir' : 'Entrar';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: colors.card }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{bolao.name}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {`${bolao.member_count} de ${bolao.max_members} participantes${bolao.requires_approval ? ' · aprovação do dono' : ''}`}
        </Text>
      </View>
      {requested ? (
        <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 12 }}>Pedido enviado</Text>
      ) : full ? (
        <Text style={{ color: colors.muted, fontWeight: '700', fontSize: 12 }}>Lotado</Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={bolao.requires_approval ? `Pedir para entrar em ${bolao.name}` : `Entrar em ${bolao.name}`}
          disabled={joining}
          onPress={onJoin}
          style={{
            paddingHorizontal: 18,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: bolao.requires_approval ? 'transparent' : colors.primary,
            borderWidth: 1,
            borderColor: colors.primary,
            opacity: joining ? 0.5 : 1,
          }}
        >
          {joining ? (
            <ActivityIndicator color={bolao.requires_approval ? colors.primary : colors.onPrimary} />
          ) : (
            <Text style={{ color: bolao.requires_approval ? colors.primary : colors.onPrimary, fontWeight: '800', fontSize: 13 }}>{action}</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

export function ExploreScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { select } = useCurrentBolao();
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim());
  const [requested, setRequested] = useState<string[]>([]);
  const list = useQuery({ queryKey: ['boloes', 'public', query], queryFn: () => listPublicBoloes(query), placeholderData: keepPreviousData });
  const join = useMutation({
    mutationFn: (id: string) => joinPublicBolao(id),
    onSuccess: async (res) => {
      track(res.status === 'active' ? 'bolao_joined' : 'join_requested');
      await queryClient.invalidateQueries({ queryKey: bolaoKeys.mine });
      if (res.status === 'active') {
        await select(res.bolao_id);
        router.replace('/');
      } else {
        setRequested((ids) => [...ids, res.bolao_id]);
      }
    },
  });
  const boloes = list.data ?? [];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <View style={{ padding: 18, borderRadius: 16, borderWidth: 1, borderColor: colors.primary, backgroundColor: 'rgba(0,166,81,0.12)', gap: 6 }}>
        <Text style={{ color: colors.text, fontWeight: '900', fontSize: 20 }}>Escolha um bolão para jogar</Text>
        <Text style={{ color: colors.muted, fontSize: 14 }}>Entre num bolão aberto, use o código de um amigo ou crie o seu.</Text>
      </View>
      <TextInput
        accessibilityLabel="Buscar bolões pelo nome"
        placeholder="Buscar bolões pelo nome"
        placeholderTextColor="#64748b"
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
        style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12, color: colors.text, fontSize: 16 }}
      />
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>Bolões abertos</Text>
      {list.isLoading && <ActivityIndicator color={colors.primary} />}
      {list.error && <Text style={{ color: colors.danger, textAlign: 'center' }}>{list.error.message}</Text>}
      {list.data && !list.isPlaceholderData && boloes.length === 0 && (
        <Text style={{ color: colors.muted, textAlign: 'center' }}>{query ? 'Nenhum bolão aberto com esse nome.' : 'Nenhum bolão aberto agora.'}</Text>
      )}
      {boloes.map((b) => (
        <PublicBolaoRow
          key={b.id}
          bolao={b}
          requested={requested.includes(b.id)}
          joining={join.isPending && join.variables === b.id}
          onJoin={() => join.mutate(b.id)}
        />
      ))}
      {join.error && <Text style={{ color: colors.danger, textAlign: 'center' }}>{join.error.message}</Text>}
      {list.data && (query || boloes.length === 0) && (
        <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 13 }}>Bolões privados não aparecem na busca. Peça o código ou o link ao dono.</Text>
      )}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <View style={{ flex: 1 }}>
          <PrimaryButton title="Tenho um código" variant="secondary" onPress={() => router.push('/entrar')} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton title="Criar bolão" onPress={() => router.push('/criar-bolao')} />
        </View>
      </View>
    </ScrollView>
  );
}
