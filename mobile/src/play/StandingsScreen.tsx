import { useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getRoundsSummary, getStandings, type Standing } from '../api/play';
import { useCurrentBolao } from '../bolao/useCurrentBolao';
import { colors } from '../theme';
import { ChampionsEntryCard } from '../champions/ChampionsEntryCard';
import { useSeasons } from '../champions/useSeasons';
import { Chip } from '../components/Chip';
import { ExploreScreen } from '../boloes/ExploreScreen';

function StandingRow({ rank, item, leader }: { rank: number; item: Standing; leader: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: leader ? colors.primary : 'transparent',
        backgroundColor: leader ? 'rgba(0,166,81,0.2)' : colors.card,
      }}
    >
      <Text style={{ width: 32, textAlign: 'center', fontWeight: '800', color: rank <= 3 ? colors.accent : colors.muted }}>{rank}º</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{item.display_name}</Text>
        {item.favorite_team ? (
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>{item.favorite_team}</Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>{item.total_points}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {item.exact_scores} placares · {item.correct_results} resultados
        </Text>
      </View>
    </View>
  );
}

export function StandingsScreen() {
  const { bolao, isLoading } = useCurrentBolao();
  const bolaoId = bolao?.id ?? '';
  const { seasons } = useSeasons();
  const [round, setRound] = useState<number | null>(null);
  const summary = useQuery({ queryKey: ['rounds', bolaoId], queryFn: () => getRoundsSummary(bolaoId), enabled: !!bolaoId });
  const standings = useQuery({
    queryKey: ['classification', bolaoId, round ?? 'geral'],
    queryFn: () => getStandings(bolaoId, round ?? undefined),
    enabled: !!bolaoId,
  });

  if (isLoading) {
    return <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} />;
  }
  if (!bolao) {
    return <ExploreScreen />;
  }

  const rounds = summary.data?.rounds ?? [];
  const data = standings.data ?? [];

  return (
    <FlatList
      data={data}
      keyExtractor={(s) => s.id}
      contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 32 }}
      ListHeaderComponent={
        <View style={{ gap: 8, marginBottom: 8 }}>
          {seasons.length > 0 && <ChampionsEntryCard latest={seasons[0]} />}
          <Text style={{ color: colors.muted, fontSize: 13 }}>{round ? `Classificação da Rodada ${round}` : 'Classificação geral'}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Chip label="Geral" active={round === null} onPress={() => setRound(null)} />
            {rounds.map((r) => (
              <Chip key={r} label={`Rodada ${r}`} active={round === r} onPress={() => setRound(r)} />
            ))}
          </ScrollView>
        </View>
      }
      ListEmptyComponent={
        standings.isLoading ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
        ) : standings.error ? (
          <Text style={{ color: colors.danger, textAlign: 'center', marginTop: 32 }}>{standings.error.message}</Text>
        ) : (
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 32 }}>Nenhum resultado ainda</Text>
        )
      }
      renderItem={({ item, index }) => <StandingRow rank={index + 1} item={item} leader={index === 0} />}
    />
  );
}
