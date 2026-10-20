import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getStandings } from '../api/play';
import { useCurrentBolao } from '../bolao/useCurrentBolao';
import { colors } from '../theme';

export function StandingsScreen() {
  const { bolao, isLoading } = useCurrentBolao();
  const bolaoId = bolao?.id ?? '';
  const standings = useQuery({ queryKey: ['classification', bolaoId], queryFn: () => getStandings(bolaoId), enabled: !!bolaoId });

  if (isLoading || standings.isLoading) {
    return <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} />;
  }
  if (!bolao) {
    return <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 48 }}>Entre em um bolão para ver a classificação.</Text>;
  }

  return (
    <FlatList
      data={standings.data ?? []}
      keyExtractor={(s) => s.id}
      contentContainerStyle={{ padding: 16, gap: 8 }}
      ListHeaderComponent={<Text style={{ color: colors.muted, fontWeight: '700', marginBottom: 4 }}>{bolao.name}</Text>}
      renderItem={({ item, index }) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: index === 0 ? '#0b3b29' : colors.card,
            borderColor: index === 0 ? colors.primary : 'transparent',
            borderWidth: 1,
            borderRadius: 14,
            padding: 14,
          }}
        >
          <Text style={{ color: index < 3 ? colors.accent : colors.muted, fontWeight: '900', width: 32 }}>{index + 1}º</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{item.display_name}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {item.exact_scores} placares · {item.correct_results} resultados
            </Text>
          </View>
          <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 18 }}>{item.total_points}</Text>
        </View>
      )}
    />
  );
}
