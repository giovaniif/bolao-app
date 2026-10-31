import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMatches, getMyPredictions, getRoundsSummary, savePredictions, type Match } from '../api/play';
import { useCurrentBolao } from '../bolao/useCurrentBolao';
import { PrimaryButton } from '../components/PrimaryButton';
import { PredictCard } from './PredictCard';
import { createAutoSaver, type SaveStatus } from './autoSave';
import { colors } from '../theme';
import { track } from '../analytics/analytics';

type Score = { home: number; away: number };
type ViewMode = 'card' | 'list';

function isClosed(match: Match, now: number) {
  return !!match.market_closes_at && new Date(match.market_closes_at).getTime() <= now;
}

function RoundChips({ rounds, round, onSelect }: { rounds: number[]; round: number; onSelect: (r: number) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {rounds.map((r) => {
        const active = r === round;
        return (
          <Pressable
            key={r}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(r)}
            style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: active ? colors.primary : colors.card, backgroundColor: active ? '#0b3b29' : colors.card }}
          >
            <Text style={{ color: active ? colors.primary : colors.muted, fontWeight: '800' }}>Rodada {r}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function SummaryList({ matches, scores, now }: { matches: Match[]; scores: Record<string, Score>; now: number }) {
  return (
    <View style={{ gap: 8 }}>
      {matches.map((m) => {
        const s = scores[m.id] ?? { home: 0, away: 0 };
        const closed = isClosed(m, now);
        return (
          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14 }}>
            <Text numberOfLines={1} style={{ color: colors.text, flex: 1 }}>
              {m.home_team} × {m.away_team}
            </Text>
            {closed && <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>Fechado</Text>}
            <Text style={{ color: colors.text, fontWeight: '800' }}>
              {s.home} × {s.away}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function PredictScreen() {
  const { bolao, isLoading } = useCurrentBolao();
  const bolaoId = bolao?.id ?? '';
  const queryClient = useQueryClient();
  const [chosenRound, setChosenRound] = useState<number | null>(null);
  const [edits, setEdits] = useState<Record<string, Score>>({});
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<ViewMode>('card');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [now] = useState(() => Date.now());

  const summary = useQuery({ queryKey: ['rounds', bolaoId], queryFn: () => getRoundsSummary(bolaoId), enabled: !!bolaoId });
  const round = chosenRound ?? summary.data?.active ?? 0;
  const matches = useQuery({ queryKey: ['matches', bolaoId, round], queryFn: () => getMatches(bolaoId, round), enabled: !!bolaoId && round > 0 });
  const saved = useQuery({ queryKey: ['predictions', bolaoId, round], queryFn: () => getMyPredictions(bolaoId, round), enabled: !!bolaoId && round > 0 });
  const list = useMemo(() => matches.data ?? [], [matches.data]);

  const scores = useMemo(() => {
    const fromServer: Record<string, Score> = {};
    for (const p of saved.data ?? []) {
      fromServer[p.match_id] = { home: Math.max(p.home_goals, 0), away: Math.max(p.away_goals, 0) };
    }
    const all: Record<string, Score> = {};
    for (const m of list) {
      all[m.id] = edits[m.id] ?? fromServer[m.id] ?? { home: 0, away: 0 };
    }
    return all;
  }, [list, saved.data, edits]);

  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});
  const [lastLeft, setLastLeft] = useState<string | null>(null);
  const saver = useMemo(
    () =>
      createAutoSaver({
        save: (matchId, score) => savePredictions(bolaoId, [{ match_id: matchId, home_goals: score.home, away_goals: score.away }]),
        onStatus: (matchId, status) => setSaveStatus((prev) => ({ ...prev, [matchId]: status })),
      }),
    [bolaoId],
  );
  useEffect(() => () => saver.dispose(), [saver]);
  useEffect(() => {
    if (!saved.data) return;
    const fromServer = new Map(saved.data.map((p) => [p.match_id, p]));
    for (const m of list) {
      const p = fromServer.get(m.id);
      saver.setBaseline(m.id, p ? { home: Math.max(p.home_goals, 0), away: Math.max(p.away_goals, 0) } : { home: 0, away: 0 });
    }
  }, [saver, saved.data, list]);

  const open = list.filter((m) => !isClosed(m, now));
  const save = useMutation({
    mutationFn: () => savePredictions(bolaoId, open.map((m) => ({ match_id: m.id, home_goals: scores[m.id].home, away_goals: scores[m.id].away }))),
    onSuccess: () => {
      for (const m of open) saver.markSaved(m.id, scores[m.id]);
      track('predictions_saved', { round, count: open.length });
      setMode('list');
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

  const currentIndex = Math.min(index, list.length - 1);
  const current = list[currentIndex];
  const goTo = (next: number) => {
    const target = Math.max(0, Math.min(next, list.length - 1));
    if (current && target !== currentIndex) {
      saver.leave(current.id, scores[current.id], isClosed(current, now));
      setLastLeft(current.id);
    }
    setIndex(target);
  };
  const leftMatch = lastLeft ? list.find((m) => m.id === lastLeft) : undefined;
  const leftStatus = lastLeft ? saveStatus[lastLeft] : undefined;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
      <RoundChips
        rounds={summary.data?.rounds ?? []}
        round={round}
        onSelect={(r) => {
          if (current) saver.leave(current.id, scores[current.id], isClosed(current, now));
          setChosenRound(r);
          setEdits({});
          setLastLeft(null);
          setIndex(0);
          setMode('card');
          save.reset();
        }}
      />
      {save.isSuccess && mode === 'list' && <Text style={{ color: colors.primary, textAlign: 'center' }}>Palpites salvos!</Text>}
      {save.error && <Text style={{ color: colors.danger, textAlign: 'center' }}>{save.error.message}</Text>}
      {matches.isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : list.length === 0 ? (
        <Text style={{ color: colors.muted, textAlign: 'center', paddingVertical: 32 }}>Nenhum jogo nesta rodada</Text>
      ) : mode === 'list' ? (
        <>
          <SummaryList matches={list} scores={scores} now={now} />
          <PrimaryButton title="Editar palpites" variant="secondary" onPress={() => setMode('card')} />
        </>
      ) : (
        <>
          <PredictCard
            items={list.map((m) => ({ id: m.id, match: m, home: scores[m.id]?.home ?? 0, away: scores[m.id]?.away ?? 0, disabled: isClosed(m, now) }))}
            index={currentIndex}
            onIndexChange={goTo}
            onChange={(id, home, away) => setEdits((prev) => ({ ...prev, [id]: { home, away } }))}
          />
          {leftMatch && leftStatus && (
            <Pressable
              accessibilityRole={leftStatus === 'error' ? 'button' : 'text'}
              disabled={leftStatus !== 'error'}
              onPress={() => saver.leave(leftMatch.id, scores[leftMatch.id], isClosed(leftMatch, now))}
              style={{ alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 12 }}
            >
              <Text style={{ color: leftStatus === 'error' ? colors.danger : colors.muted, fontSize: 12 }}>
                {leftStatus === 'saving'
                  ? `Salvando ${leftMatch.home_team} × ${leftMatch.away_team}…`
                  : leftStatus === 'saved'
                    ? `${leftMatch.home_team} × ${leftMatch.away_team} salvo`
                    : `Não salvou ${leftMatch.home_team} × ${leftMatch.away_team}. Tentando de novo`}
              </Text>
            </Pressable>
          )}
          <View style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Ver resumo dos jogos" accessibilityState={{ expanded: summaryOpen }} onPress={() => setSummaryOpen((o) => !o)} style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              <Text style={{ color: colors.muted, fontSize: 14 }}>{summaryOpen ? '▾' : '▸'} Ver resumo dos jogos</Text>
            </Pressable>
            {summaryOpen && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
                {list.map((m, i) => {
                  const s = scores[m.id] ?? { home: 0, away: 0 };
                  return (
                    <Pressable
                      key={m.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${m.home_team} × ${m.away_team}`}
                      onPress={() => goTo(i)}
                      style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: i === index ? '#0b3b29' : 'transparent' }}
                    >
                      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, flex: 1 }}>
                        {m.home_team} × {m.away_team}
                      </Text>
                      <Text style={{ color: colors.text, fontSize: 14, marginLeft: 8 }}>
                        {s.home}×{s.away}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
          {open.length > 0 && <PrimaryButton title="Salvar palpites" onPress={() => save.mutate()} loading={save.isPending} />}
        </>
      )}
    </ScrollView>
  );
}
