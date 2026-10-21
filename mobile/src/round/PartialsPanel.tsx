import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clearPartial, getPartials, getPartialStandings, setPartial, type MatchWithPartial } from '../api/round';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme';

type Partial = { h: number | null; a: number | null };

function Stepper({ team, value, onChange }: { team: string; value: number | null; onChange: (v: number) => void }) {
  const button = { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.border, alignItems: 'center' as const, justifyContent: 'center' as const };
  const current = value ?? 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Menos um gol de ${team}`} disabled={current === 0} onPress={() => onChange(current - 1)} style={[button, { opacity: current === 0 ? 0.4 : 1 }]}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>−</Text>
      </Pressable>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', minWidth: 22, textAlign: 'center' }}>{value ?? '–'}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Mais um gol de ${team}`} onPress={() => onChange(Math.min(99, current + 1))} style={button}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>+</Text>
      </Pressable>
    </View>
  );
}

const card = { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 12 };

export function PartialsPanel({ bolaoId, round }: { bolaoId: string; round: number }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<Record<string, Partial>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [shownRound, setShownRound] = useState(round);
  if (round !== shownRound) {
    setShownRound(round);
    setEditing(false);
    setEdits({});
    setMessage(null);
  }

  const matchesKey = ['partials', bolaoId, round];
  const standingsKey = ['partials', bolaoId, round, 'classification'];
  const matches = useQuery({ queryKey: matchesKey, queryFn: () => getPartials(bolaoId, round), enabled: round > 0 });
  const standings = useQuery({ queryKey: standingsKey, queryFn: () => getPartialStandings(bolaoId, round), enabled: round > 0 });
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
          {list.map((m) => {
            const p = partials[m.id];
            return (
              <View key={m.id} style={[card, { gap: 10 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{m.home_team}</Text>
                  <Stepper team={m.home_team} value={p.h} onChange={(v) => setEdits((prev) => ({ ...prev, [m.id]: { h: v, a: p.a } }))} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{m.away_team}</Text>
                  <Stepper team={m.away_team} value={p.a} onChange={(v) => setEdits((prev) => ({ ...prev, [m.id]: { h: p.h, a: v } }))} />
                </View>
                {m.partial_home != null && m.partial_away != null && (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Limpar parcial de ${m.home_team} x ${m.away_team}`} disabled={clear.isPending} onPress={() => clear.mutate(m.id)}>
                    <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '600' }}>Limpar parcial</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
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
