import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getRoundsSummary } from '../api/play';
import { getMembers } from '../api/round';
import { useCurrentBolao } from '../bolao/useCurrentBolao';
import { colors } from '../theme';
import { PartialsPanel } from './PartialsPanel';
import { PlayersPanel } from './PlayersPanel';

type Tab = 'parciais' | 'galera';

const SEGMENTS: { value: Tab; label: string }[] = [
  { value: 'parciais', label: 'Parciais' },
  { value: 'galera', label: 'Galera' },
];

export function RoundScreen() {
  const { bolao, isLoading } = useCurrentBolao();
  const bolaoId = bolao?.id ?? '';
  const [chosenRound, setChosenRound] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('parciais');
  const [visited, setVisited] = useState<ReadonlySet<Tab>>(() => new Set<Tab>(['parciais']));

  const summary = useQuery({ queryKey: ['rounds', bolaoId], queryFn: () => getRoundsSummary(bolaoId), enabled: !!bolaoId });
  const members = useQuery({ queryKey: ['members', bolaoId], queryFn: () => getMembers(bolaoId), enabled: !!bolaoId });
  const round = chosenRound ?? summary.data?.active ?? 0;
  const players = (members.data ?? []).filter((m) => m.status === 'active');

  if (isLoading) {
    return <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} />;
  }
  if (!bolao) {
    return <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 48 }}>Entre em um bolão para ver a rodada.</Text>;
  }

  function choose(next: Tab) {
    setTab(next);
    if (!visited.has(next)) {
      setVisited(new Set(visited).add(next));
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: '900' }}>{round > 0 ? `Rodada ${round}` : 'Rodada'}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '700' }}>{members.data ? `${players.length} jogadores` : ''}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {(summary.data?.rounds ?? []).map((r) => {
          const active = r === round;
          return (
            <Pressable
              key={r}
              accessibilityRole="button"
              accessibilityLabel={`Rodada ${r}`}
              accessibilityState={{ selected: active }}
              onPress={() => setChosenRound(r)}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: active ? colors.primary : colors.card, backgroundColor: active ? '#0b3b29' : colors.card }}
            >
              <Text style={{ color: active ? colors.primary : colors.muted, fontWeight: '800' }}>{`Rodada ${r}`}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View accessibilityLabel="Visão da rodada" style={{ flexDirection: 'row', backgroundColor: colors.card, borderRadius: 14, padding: 4 }}>
        {SEGMENTS.map((s) => {
          const active = s.value === tab;
          return (
            <Pressable
              key={s.value}
              accessibilityRole="tab"
              accessibilityLabel={s.label}
              accessibilityState={{ selected: active }}
              onPress={() => choose(s.value)}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: active ? colors.bg : 'transparent' }}
            >
              <Text style={{ color: active ? colors.text : colors.muted, fontWeight: '800' }}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {visited.has('parciais') && (
        <View style={{ display: tab === 'parciais' ? 'flex' : 'none' }}>
          <PartialsPanel bolaoId={bolaoId} round={round} />
        </View>
      )}
      {visited.has('galera') && (
        <View style={{ display: tab === 'galera' ? 'flex' : 'none' }}>
          <PlayersPanel bolaoId={bolaoId} round={round} players={players} />
        </View>
      )}
    </ScrollView>
  );
}
