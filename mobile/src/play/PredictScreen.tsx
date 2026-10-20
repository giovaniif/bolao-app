import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMatches, getMyPredictions, getRoundsSummary, savePredictions, type Match } from '../api/play';
import { useCurrentBolao } from '../bolao/useCurrentBolao';
import { PrimaryButton } from '../components/PrimaryButton';
import { MatchRow } from './MatchRow';
import { colors } from '../theme';

type Score = { home: number; away: number };

function isClosed(match: Match, now: number) {
  return !!match.market_closes_at && new Date(match.market_closes_at).getTime() <= now;
}

export function PredictScreen() {
  const { bolao, isLoading } = useCurrentBolao();
  const bolaoId = bolao?.id ?? '';
  const queryClient = useQueryClient();
  const [chosenRound, setChosenRound] = useState<number | null>(null);
  const [edits, setEdits] = useState<Record<string, Score>>({});
  const [now] = useState(() => Date.now());

  const summary = useQuery({ queryKey: ['rounds', bolaoId], queryFn: () => getRoundsSummary(bolaoId), enabled: !!bolaoId });
  const round = chosenRound ?? summary.data?.active ?? 0;
  const matches = useQuery({ queryKey: ['matches', bolaoId, round], queryFn: () => getMatches(bolaoId, round), enabled: !!bolaoId && round > 0 });
  const saved = useQuery({ queryKey: ['predictions', bolaoId, round], queryFn: () => getMyPredictions(bolaoId, round), enabled: !!bolaoId && round > 0 });

  const scores = useMemo(() => {
    const fromServer: Record<string, Score> = {};
    for (const p of saved.data ?? []) {
      fromServer[p.match_id] = { home: Math.max(p.home_goals, 0), away: Math.max(p.away_goals, 0) };
    }
    const all: Record<string, Score> = {};
    for (const m of matches.data ?? []) {
      all[m.id] = edits[m.id] ?? fromServer[m.id] ?? { home: 0, away: 0 };
    }
    return all;
  }, [matches.data, saved.data, edits]);

  const open = (matches.data ?? []).filter((m) => !isClosed(m, now));
  const save = useMutation({
    mutationFn: () => savePredictions(bolaoId, open.map((m) => ({ match_id: m.id, home_goals: scores[m.id].home, away_goals: scores[m.id].away }))),
    onSuccess: () => {
      setEdits({});
      queryClient.invalidateQueries({ queryKey: ['predictions', bolaoId, round] });
    },
  });

  if (isLoading) {
    return <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} />;
  }
  if (!bolao) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <Text style={{ color: colors.muted, textAlign: 'center' }}>Entre em um bolão para palpitar.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      <Text style={{ color: colors.muted, fontWeight: '700' }}>{bolao.name}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {(summary.data?.rounds ?? []).map((r) => (
          <Pressable
            key={r}
            accessibilityRole="button"
            accessibilityState={{ selected: r === round }}
            onPress={() => {
              setChosenRound(r);
              setEdits({});
            }}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: r === round ? colors.primary : colors.card }}
          >
            <Text style={{ color: r === round ? colors.onPrimary : colors.text, fontWeight: '700' }}>Rodada {r}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {matches.isLoading && <ActivityIndicator color={colors.primary} />}
      {(matches.data ?? []).map((m) => (
        <MatchRow
          key={m.id}
          match={m}
          home={scores[m.id]?.home ?? 0}
          away={scores[m.id]?.away ?? 0}
          closed={isClosed(m, now)}
          onChange={(home, away) => setEdits((prev) => ({ ...prev, [m.id]: { home, away } }))}
        />
      ))}
      {save.isSuccess && Object.keys(edits).length === 0 && <Text style={{ color: colors.primary, textAlign: 'center' }}>Palpites salvos!</Text>}
      {save.error && <Text style={{ color: colors.danger, textAlign: 'center' }}>{save.error.message}</Text>}
      {open.length > 0 && <PrimaryButton title="Salvar palpites" onPress={() => save.mutate()} loading={save.isPending} />}
    </ScrollView>
  );
}
