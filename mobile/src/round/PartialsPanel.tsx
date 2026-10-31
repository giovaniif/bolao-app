import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clearPartial, getPartials, getPartialStandings, setPartial, type MatchWithPartial } from '../api/round';
import { PrimaryButton } from '../components/PrimaryButton';
import { PredictCard } from '../play/PredictCard';
import { colors } from '../theme';
import { liveRefetchInterval } from './liveRefetch';

type Partial = { h: number | null; a: number | null };

const card = { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 12 };

export function PartialsPanel({ bolaoId, round }: { bolaoId: string; round: number }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<Record<string, Partial>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [index, setIndex] = useState(0);
  const [shownRound, setShownRound] = useState(round);
  if (round !== shownRound) {
    setShownRound(round);
    setEditing(false);
    setEdits({});
    setMessage(null);
    setIndex(0);
  }

  const matchesKey = ['partials', bolaoId, round];
  const standingsKey = ['partials', bolaoId, round, 'classification'];
  const matches = useQuery({
    queryKey: matchesKey,
    queryFn: () => getPartials(bolaoId, round),
    enabled: round > 0,
    refetchInterval: (query) => liveRefetchInterval(query.state.data),
  });
  const standings = useQuery({
    queryKey: standingsKey,
    queryFn: () => getPartialStandings(bolaoId, round),
    enabled: round > 0,
    refetchInterval: liveRefetchInterval(matches.data),
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['partials', bolaoId, round] });
  };

  const partials = useMemo(() => {
    const map: Record<string, Partial> = {};
    for (const m of matches.data ?? []) {
      map[m.id] = edits[m.id] ?? { h: m.partial_home ?? null, a: m.partial_away ?? null };
    }
    return map;
  }, [matches.data, edits]);

  const save = useMutation({
    mutationFn: async (list: MatchWithPartial[]) => {
      for (const m of list) {
        const p = partials[m.id];
        if (!p || (p.h == null && p.a == null)) {
          continue;
        }
        const h = p.h ?? 0;
        const a = p.a ?? 0;
        if (h !== (m.partial_home ?? 0) || a !== (m.partial_away ?? 0)) {
          await setPartial(m.id, h, a);
        }
      }
    },
    onSuccess: () => {
      setMessage({ ok: true, text: 'Parciais salvos!' });
      setEditing(false);
      setEdits({});
      refresh();
    },
    onError: (err) => setMessage({ ok: false, text: err.message }),
  });

  const clear = useMutation({
    mutationFn: (matchId: string) => clearPartial(matchId),
    onSuccess: (_, matchId) => {
      setEdits((prev) => ({ ...prev, [matchId]: { h: null, a: null } }));
      setMessage({ ok: true, text: 'Parcial removida.' });
      refresh();
    },
    onError: (err) => setMessage({ ok: false, text: err.message }),
  });

  const list = matches.data ?? [];
  const hasPartials = list.some((m) => m.partial_home != null && m.partial_away != null);

  return (
    <View style={{ gap: 12 }}>
      {message && <Text style={{ color: message.ok ? colors.primary : colors.danger, textAlign: 'center' }}>{message.text}</Text>}
      {matches.isLoading ? (
        <Text style={{ color: colors.muted }}>Carregando...</Text>
      ) : list.length === 0 ? (
        <Text style={{ color: colors.muted }}>Nenhum jogo nesta rodada.</Text>
      ) : editing ? (
        <>
          <Text style={{ color: colors.muted, fontSize: 13 }}>Qualquer usuário pode adicionar parciais</Text>
          {(() => {
            const i = Math.min(index, list.length - 1);
            const m = list[i];
            return (
              <>
                <PredictCard
                  items={list.map((x) => ({
                    id: x.id,
                    match: { home_team: x.home_team, away_team: x.away_team, home_goals: x.real_home_goals, away_goals: x.real_away_goals },
                    home: partials[x.id].h ?? 0,
                    away: partials[x.id].a ?? 0,
                    disabled: false,
                  }))}
                  index={i}
                  onIndexChange={(n) => setIndex(Math.max(0, Math.min(n, list.length - 1)))}
                  onChange={(id, h, a) => setEdits((prev) => ({ ...prev, [id]: { h, a } }))}
                />
                {m.partial_home != null && m.partial_away != null && (
                  <Pressable accessibilityRole="button" accessibilityLabel="Limpar parcial" disabled={clear.isPending} onPress={() => { setMessage(null); clear.mutate(m.id); }} style={{ borderColor: colors.danger, borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', opacity: clear.isPending ? 0.5 : 1 }}>
                    <Text style={{ color: colors.danger, fontSize: 14, fontWeight: '600' }}>{clear.isPending ? 'Limpando...' : 'Limpar parcial'}</Text>
                  </Pressable>
                )}
                <View style={card}>
                  {list.map((other, j) => {
                    const q = partials[other.id];
                    return (
                      <Pressable key={other.id} accessibilityRole="button" accessibilityLabel={`Ir para ${other.home_team} x ${other.away_team}`} onPress={() => setIndex(j)} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, backgroundColor: j === i ? colors.border : 'transparent' }}>
                        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, flex: 1 }}>{`${other.home_team} × ${other.away_team}`}</Text>
                        <Text style={{ color: colors.text, fontSize: 13, marginLeft: 8 }}>{`${q.h ?? '–'}×${q.a ?? '–'}`}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            );
          })()}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Voltar" variant="secondary" onPress={() => { setEditing(false); setEdits({}); }} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Salvar parciais" loading={save.isPending} onPress={() => { setMessage(null); save.mutate(list); }} />
            </View>
          </View>
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontSize: 16 }}>Parciais da rodada</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Editar" onPress={() => setEditing(true)}>
              <Text style={{ color: colors.primary }}>Editar</Text>
            </Pressable>
          </View>
          {list.map((m) => {
            const p = partials[m.id];
            return (
              <View key={m.id} style={card}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={{ color: colors.text }}>{m.home_team}</Text>
                  <Text style={{ color: colors.muted }}>{`${p.h ?? '–'} × ${p.a ?? '–'}`}</Text>
                  <Text style={{ color: colors.text }}>{m.away_team}</Text>
                </View>
                {m.real_home_goals != null && m.real_away_goals != null && (
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{`Resultado final: ${m.real_home_goals} × ${m.real_away_goals}`}</Text>
                )}
              </View>
            );
          })}
          <Pressable accessibilityRole="button" accessibilityLabel="Editar parciais" onPress={() => setEditing(true)} style={{ borderColor: colors.primary, borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ color: colors.primary, fontSize: 16 }}>Editar parciais</Text>
          </Pressable>
        </>
      )}

      {hasPartials && (standings.data ?? []).length > 0 && (
        <View style={{ gap: 8, marginTop: 8 }}>
          <Text style={{ color: colors.muted, fontSize: 14 }}>Classificação baseada nas parciais</Text>
          <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, overflow: 'hidden' }}>
            {(standings.data ?? []).map((u, i) => (
              <View key={u.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>{`${i + 1}. ${u.display_name}`}</Text>
                <Text style={{ color: colors.primary }}>{`${u.total_points} pts`}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {hasPartials && standings.isSuccess && (standings.data ?? []).length === 0 && (
        <Text style={{ color: colors.muted, fontSize: 13 }}>Adicione parciais aos jogos para ver a classificação.</Text>
      )}
    </View>
  );
}
