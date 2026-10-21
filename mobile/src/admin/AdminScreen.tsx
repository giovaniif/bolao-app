import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adminKeys,
  finishActiveBolao,
  getActiveBolao,
  getAdminMatches,
  getAdminRoundsSummary,
  getParticipants,
  setAmountPaid,
  setMatchResult,
  setRoundCloses,
  unlockMatch,
  type AdminMatch,
  type Participant,
} from '../api/admin';
import { useCurrentBolao } from '../bolao/useCurrentBolao';
import { PrimaryButton } from '../components/PrimaryButton';
import { TextField } from '../components/TextField';
import { colors } from '../theme';
import { formatCloseTime, parseCloseTime } from './closeTime';

type Tab = 'jogos' | 'participantes' | 'bolao';

const TABS: { key: Tab; label: string }[] = [
  { key: 'jogos', label: 'Jogos' },
  { key: 'participantes', label: 'Participantes' },
  { key: 'bolao', label: 'Bolão' },
];

const TOTAL_VALUE = 70;

function Stepper({ team, value, onChange }: { team: string; value: number; onChange: (v: number) => void }) {
  const button = { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.border, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text numberOfLines={1} style={{ color: colors.text, flex: 1, fontWeight: '600' }}>{team}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Menos um gol de ${team}`} disabled={value === 0} onPress={() => onChange(value - 1)} style={[button, { opacity: value === 0 ? 0.4 : 1 }]}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>−</Text>
      </Pressable>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', minWidth: 24, textAlign: 'center' }}>{value}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Mais um gol de ${team}`} onPress={() => onChange(value + 1)} style={button}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>+</Text>
      </Pressable>
    </View>
  );
}

function FeedBadge({ match, onUnlock, unlocking }: { match: AdminMatch; onUnlock: () => void; unlocking: boolean }) {
  if (match.provider_match_id == null) {
    return null;
  }
  if (!match.locked) {
    return (
      <View style={{ flexDirection: 'row' }}>
        <Text style={{ fontSize: 11, color: colors.muted, backgroundColor: colors.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>Automático</Text>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ fontSize: 11, color: '#fcd34d', backgroundColor: '#78350f66', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>Corrigido</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar ao automático" disabled={unlocking} onPress={onUnlock}>
        <Text style={{ fontSize: 11, color: colors.primary, opacity: unlocking ? 0.5 : 1 }}>Voltar ao automático</Text>
      </Pressable>
    </View>
  );
}

function MatchCard({ bolaoId, match, round }: { bolaoId: string; match: AdminMatch; round: number }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [home, setHome] = useState(match.home_goals ?? 0);
  const [away, setAway] = useState(match.away_goals ?? 0);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: adminKeys.matches(bolaoId, round) });
    queryClient.invalidateQueries({ queryKey: adminKeys.summary(bolaoId) });
  };
  const save = useMutation({
    mutationFn: () => setMatchResult(bolaoId, match.id, home, away),
    onSuccess: () => {
      setEditing(false);
      refresh();
    },
  });
  const unlock = useMutation({ mutationFn: () => unlockMatch(bolaoId, match.id), onSuccess: refresh });
  const hasResult = match.home_goals != null && match.away_goals != null;
  const label = `${match.home_team} x ${match.away_team}`;

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '600', flexShrink: 1 }}>{match.home_team}</Text>
        <Text style={{ color: hasResult ? colors.text : colors.muted, fontWeight: '800' }}>{hasResult ? `${match.home_goals} × ${match.away_goals}` : '×'}</Text>
        <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '600', flexShrink: 1 }}>{match.away_team}</Text>
      </View>
      <FeedBadge match={match} unlocking={unlock.isPending} onUnlock={() => unlock.mutate()} />
      {editing ? (
        <View style={{ gap: 10, marginTop: 4 }}>
          <Stepper team={match.home_team} value={home} onChange={setHome} />
          <Stepper team={match.away_team} value={away} onChange={setAway} />
          {save.error && <Text style={{ color: colors.danger }}>{save.error.message}</Text>}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Cancelar" variant="secondary" onPress={() => setEditing(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Salvar resultado" loading={save.isPending} onPress={() => save.mutate()} />
            </View>
          </View>
        </View>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={`Definir resultado de ${label}`} onPress={() => setEditing(true)}>
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>{hasResult ? 'Corrigir resultado' : 'Definir resultado'}</Text>
        </Pressable>
      )}
    </View>
  );
}

function RoundCloses({ bolaoId, round, matches }: { bolaoId: string; round: number; matches: AdminMatch[] }) {
  const queryClient = useQueryClient();
  const current = matches.find((m) => m.market_closes_at)?.market_closes_at;
  const currentDate = current ? new Date(current) : null;
  const [text, setText] = useState(currentDate ? formatCloseTime(currentDate) : '');
  const closesAt = parseCloseTime(text, (currentDate ?? new Date()).getFullYear());
  const save = useMutation({
    mutationFn: (date: Date) => setRoundCloses(bolaoId, round, date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.matches(bolaoId, round) });
      queryClient.invalidateQueries({ queryKey: adminKeys.summary(bolaoId) });
    },
  });

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: colors.border }}>
      <TextField label="Fechamento da rodada (dd/mm hh:mm)" value={text} onChangeText={setText} keyboardType="numbers-and-punctuation" />
      {save.error && <Text style={{ color: colors.danger }}>{save.error.message}</Text>}
      {save.isSuccess && <Text style={{ color: colors.primary }}>Fechamento salvo.</Text>}
      <PrimaryButton title="Salvar fechamento" loading={save.isPending} disabled={!closesAt} onPress={() => closesAt && save.mutate(closesAt)} />
    </View>
  );
}

function BolaoPicker({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const { boloes } = useCurrentBolao();
  const options = boloes.filter((b) => b.member_status === 'active' && b.status === 'active');
  if (options.length < 2) {
    return null;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {options.map((b) => (
        <Pressable
          key={b.id}
          accessibilityRole="button"
          accessibilityLabel={`Bolão ${b.name}`}
          accessibilityState={{ selected: b.id === selected }}
          onPress={() => onSelect(b.id)}
          style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: b.id === selected ? colors.primary : colors.border, backgroundColor: colors.card }}
        >
          <Text style={{ color: b.id === selected ? colors.primary : colors.text, fontWeight: '700' }}>{b.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function MatchesPanel() {
  const { bolao, boloes, isLoading } = useCurrentBolao();
  const [pickedBolao, setPickedBolao] = useState<string | null>(null);
  const fallback = bolao?.status === 'active' ? bolao.id : boloes.find((b) => b.member_status === 'active' && b.status === 'active')?.id;
  const bolaoId = pickedBolao ?? fallback ?? '';
  const [chosen, setChosen] = useState<number | null>(null);
  const summary = useQuery({ queryKey: adminKeys.summary(bolaoId), queryFn: () => getAdminRoundsSummary(bolaoId), enabled: !!bolaoId });
  const round = chosen ?? summary.data?.active ?? 0;
  const matches = useQuery({ queryKey: adminKeys.matches(bolaoId, round), queryFn: () => getAdminMatches(bolaoId, round), enabled: !!bolaoId && round > 0 });

  if (isLoading) {
    return <ActivityIndicator color={colors.primary} />;
  }
  if (!bolaoId) {
    return <Text style={{ color: colors.muted }}>Nenhum bolão ativo no momento.</Text>;
  }

  return (
    <View style={{ gap: 12 }}>
      <BolaoPicker
        selected={bolaoId}
        onSelect={(id) => {
          setPickedBolao(id);
          setChosen(null);
        }}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {(summary.data?.rounds ?? []).map((r) => (
          <Pressable
            key={r}
            accessibilityRole="button"
            accessibilityLabel={`Rodada ${r}`}
            accessibilityState={{ selected: r === round }}
            onPress={() => setChosen(r)}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: r === round ? colors.primary : 'transparent', backgroundColor: r === round ? '#00a65122' : colors.card }}
          >
            <Text style={{ color: r === round ? colors.primary : colors.muted, fontWeight: '800' }}>Rodada {r}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {(summary.isLoading || matches.isLoading) && <ActivityIndicator color={colors.primary} />}
      {matches.data && <RoundCloses key={`${bolaoId}-${round}`} bolaoId={bolaoId} round={round} matches={matches.data} />}
      {(matches.data ?? []).map((m) => (
        <MatchCard key={m.id} bolaoId={bolaoId} match={m} round={round} />
      ))}
    </View>
  );
}

function ParticipantRow({ bolaoId, participant }: { bolaoId: string; participant: Participant }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(participant.amount_paid));
  const amount = Number(value.replace(',', '.'));
  const save = useMutation({
    mutationFn: () => setAmountPaid(bolaoId, participant.id, amount),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: adminKeys.participants(bolaoId) });
    },
  });

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flexShrink: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>{participant.display_name}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>@{participant.username}</Text>
        </View>
        {!editing && (
          <Pressable accessibilityRole="button" accessibilityLabel={`Editar valor pago de ${participant.display_name}`} onPress={() => setEditing(true)}>
            <Text style={{ color: participant.amount_paid >= TOTAL_VALUE ? colors.primary : colors.accent, fontWeight: '700' }}>
              R$ {participant.amount_paid.toFixed(2)} / {TOTAL_VALUE} ✎
            </Text>
          </Pressable>
        )}
      </View>
      {editing && (
        <View style={{ gap: 8 }}>
          <TextField label="Valor pago" value={value} onChangeText={setValue} keyboardType="decimal-pad" />
          {save.error && <Text style={{ color: colors.danger }}>{save.error.message}</Text>}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Cancelar" variant="secondary" onPress={() => setEditing(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Salvar valor" loading={save.isPending} disabled={Number.isNaN(amount) || amount < 0} onPress={() => save.mutate()} />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function ParticipantsPanel() {
  const active = useQuery({ queryKey: adminKeys.active, queryFn: getActiveBolao });
  const bolaoId = active.data?.id ?? '';
  const participants = useQuery({ queryKey: adminKeys.participants(bolaoId), queryFn: () => getParticipants(bolaoId), enabled: !!bolaoId });
  if (active.isLoading || participants.isLoading) {
    return <ActivityIndicator color={colors.primary} />;
  }
  return (
    <View style={{ gap: 8 }}>
      {(participants.data ?? []).map((p) => (
        <ParticipantRow key={p.id} bolaoId={bolaoId} participant={p} />
      ))}
    </View>
  );
}

function BolaoPanel() {
  const queryClient = useQueryClient();
  const active = useQuery({ queryKey: adminKeys.active, queryFn: getActiveBolao, retry: false });
  const [confirming, setConfirming] = useState(false);
  const [unresolved, setUnresolved] = useState(false);
  const finish = useMutation({
    mutationFn: (force: boolean) => finishActiveBolao(force),
    onSuccess: () => {
      setConfirming(false);
      setUnresolved(false);
      queryClient.invalidateQueries({ queryKey: adminKeys.active });
      queryClient.invalidateQueries({ queryKey: ['me', 'boloes'] });
    },
    onError: (err) => {
      if ((err as Error & { status?: number }).status === 409) {
        setUnresolved(true);
      }
    },
  });

  if (active.isLoading) {
    return <ActivityIndicator color={colors.primary} />;
  }
  if (!active.data) {
    return <Text style={{ color: colors.muted }}>Nenhum bolão ativo no momento.</Text>;
  }

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.border }}>
      <View>
        <Text style={{ color: colors.muted, fontSize: 13 }}>Bolão ativo</Text>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{active.data.name}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Iniciado em {new Date(active.data.started_at).toLocaleDateString('pt-BR')}</Text>
      </View>
      {unresolved ? (
        <View style={{ gap: 8, padding: 12, borderRadius: 10, backgroundColor: '#450a0a66', borderWidth: 1, borderColor: '#991b1b' }}>
          <Text style={{ color: '#fca5a5' }}>Há jogos sem resultado definido.</Text>
          <PrimaryButton title="Finalizar mesmo assim" loading={finish.isPending} onPress={() => finish.mutate(true)} />
          <PrimaryButton title="Cancelar" variant="secondary" onPress={() => { setUnresolved(false); setConfirming(false); }} />
        </View>
      ) : confirming ? (
        <View style={{ gap: 8 }}>
          {finish.error && (finish.error as Error & { status?: number }).status !== 409 && <Text style={{ color: colors.danger }}>{finish.error.message}</Text>}
          <PrimaryButton title="Confirmar finalização" loading={finish.isPending} onPress={() => finish.mutate(false)} />
          <PrimaryButton title="Cancelar" variant="secondary" onPress={() => setConfirming(false)} />
        </View>
      ) : (
        <PrimaryButton title="Finalizar bolão" variant="secondary" onPress={() => setConfirming(true)} />
      )}
    </View>
  );
}

export function AdminScreen() {
  const [tab, setTab] = useState<Tab>('jogos');
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, padding: 4 }}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: tab === t.key }}
            onPress={() => setTab(t.key)}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center', backgroundColor: tab === t.key ? colors.bg : 'transparent' }}
          >
            <Text style={{ color: tab === t.key ? colors.text : colors.muted, fontWeight: '800' }}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'jogos' && <MatchesPanel />}
      {tab === 'participantes' && <ParticipantsPanel />}
      {tab === 'bolao' && <BolaoPanel />}
    </ScrollView>
  );
}
