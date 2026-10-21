import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getRoundsSummary, type Standing } from '../api/play';
import { colors } from '../theme';
import { tallyTitles, type Season } from './season';
import { useSeasons } from './useSeasons';

type HallView = 'campeao' | 'temporadas';

const GOLD = 'rgba(255,215,0,0.35)';
const GOLD_SOFT = 'rgba(255,215,0,0.08)';
const SILVER = '#cbd5e1';
const BRONZE = '#b45309';
const COLLAPSED = 5;
const FIRST_RANK = 4;

function SectionTitle({ children }: { children: string }) {
  return <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 }}>{children}</Text>;
}

function Segmented({ value, onChange }: { value: HallView; onChange: (v: HallView) => void }) {
  const options: { value: HallView; label: string }[] = [
    { value: 'campeao', label: 'Campeão' },
    { value: 'temporadas', label: 'Temporadas' },
  ];
  return (
    <View style={{ flexDirection: 'row', padding: 4, borderRadius: 12, backgroundColor: colors.card }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center', backgroundColor: active ? colors.bg : 'transparent' }}
          >
            <Text style={{ color: active ? colors.text : colors.muted, fontWeight: '700', fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SeasonChips({ seasons, selectedId, onSelect }: { seasons: Season[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {seasons.map((s) => {
        const active = s.bolao.id === selectedId;
        return (
          <Pressable
            key={s.bolao.id}
            accessibilityRole="button"
            accessibilityLabel={s.bolao.name}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(s.bolao.id)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: active ? colors.accent : 'transparent',
              backgroundColor: active ? 'rgba(255,215,0,0.15)' : colors.card,
            }}
          >
            <Text style={{ color: active ? colors.accent : colors.muted, fontWeight: '800', fontSize: 13 }}>{s.bolao.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Stat({ value, label, gold = false }: { value: number; label: string; gold?: boolean }) {
  return (
    <View style={{ flex: 1, gap: 2, padding: 12, borderRadius: 14, backgroundColor: 'rgba(15,23,42,0.6)' }}>
      <Text style={{ color: gold ? colors.accent : colors.text, fontSize: 20, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function ChampionHero({ season, rounds }: { season: Season; rounds?: number }) {
  const { champion, margin, year } = season;
  if (!champion) return null;
  const subtitle = [champion.favorite_team, margin > 0 ? `venceu por ${margin} pontos` : null].filter(Boolean).join(' · ');
  return (
    <View style={{ gap: 16, padding: 20, borderRadius: 22, borderWidth: 1, borderColor: GOLD, backgroundColor: GOLD_SOFT }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 }}>{`CAMPEÃO ${year}`}</Text>
        {rounds != null && <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '600' }}>{`${rounds} ${rounds === 1 ? 'rodada' : 'rodadas'}`}</Text>}
      </View>
      <View style={{ gap: 2 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>{champion.display_name}</Text>
        {subtitle ? <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 13 }}>{subtitle}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Stat value={champion.total_points} label="pontos" gold />
        <Stat value={champion.exact_scores} label="placares" />
        <Stat value={champion.rounds_won ?? 0} label="rodadas vencidas" />
      </View>
    </View>
  );
}

function Place({ label, user, color }: { label: string; user: Standing; color: string }) {
  return (
    <View style={{ flex: 1, gap: 6, padding: 14, borderRadius: 16, borderTopWidth: 3, borderTopColor: color, backgroundColor: colors.card }}>
      <Text style={{ color, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 }}>{label}</Text>
      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{user.display_name}</Text>
      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>{`${user.total_points} pts${user.favorite_team ? ` · ${user.favorite_team}` : ''}`}</Text>
    </View>
  );
}

function RunnersUp({ runnerUp, third }: { runnerUp?: Standing; third?: Standing }) {
  if (!runnerUp) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Place label="2º LUGAR" user={runnerUp} color={SILVER} />
      {third ? <Place label="3º LUGAR" user={third} color={BRONZE} /> : <View style={{ flex: 1 }} />}
    </View>
  );
}

function FinalStandings({ ranking }: { ranking: Standing[] }) {
  const [expanded, setExpanded] = useState(false);
  const rest = ranking.slice(FIRST_RANK - 1);
  if (rest.length === 0) return null;
  const shown = expanded ? rest : rest.slice(0, COLLAPSED);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionTitle>CLASSIFICAÇÃO FINAL</SectionTitle>
        {rest.length > COLLAPSED && (
          <Pressable accessibilityRole="button" onPress={() => setExpanded((v) => !v)}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600' }}>{expanded ? 'Ver menos' : 'Ver tudo'}</Text>
          </Pressable>
        )}
      </View>
      {shown.map((u, i) => (
        <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, backgroundColor: colors.card }}>
          <Text style={{ width: 32, textAlign: 'center', fontWeight: '800', color: colors.muted }}>{`${FIRST_RANK + i}º`}</Text>
          <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontWeight: '600', fontSize: 15 }}>{u.display_name}</Text>
          <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>{u.total_points}</Text>
        </View>
      ))}
    </View>
  );
}

function SeasonGallery({ seasons, onSelect }: { seasons: Season[]; onSelect: (id: string) => void }) {
  return (
    <View style={{ gap: 12 }}>
      {seasons.map((season, i) => {
        const highlight = i === 0;
        const champion = season.champion;
        const players = `${season.players} ${season.players === 1 ? 'jogador' : 'jogadores'}`;
        return (
          <Pressable
            key={season.bolao.id}
            accessibilityRole="button"
            accessibilityLabel={`Temporada ${season.bolao.name}`}
            onPress={() => onSelect(season.bolao.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              padding: 16,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: highlight ? GOLD : 'transparent',
              backgroundColor: highlight ? GOLD_SOFT : colors.card,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: highlight ? colors.accent : '#64748b', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 }}>
                {season.bolao.name.toUpperCase()}
              </Text>
              <Text numberOfLines={1} style={{ marginTop: 4, color: colors.text, fontSize: 16, fontWeight: '700' }}>{champion?.display_name ?? '—'}</Text>
              <Text numberOfLines={1} style={{ marginTop: 2, color: colors.muted, fontSize: 12 }}>
                {champion ? `${champion.total_points} pontos · ${players}` : players}
              </Text>
            </View>
            <Text style={{ color: highlight ? colors.accent : colors.muted, fontSize: 18 }}>›</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function BiggestWinners({ seasons }: { seasons: Season[] }) {
  const winners = useMemo(() => tallyTitles(seasons), [seasons]);
  if (winners.length === 0) return null;
  const most = winners[0].titles;
  return (
    <View style={{ gap: 12, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.card }}>
      <SectionTitle>MAIORES VENCEDORES</SectionTitle>
      {winners.map((w) => (
        <View key={w.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <Text numberOfLines={1} style={{ flexShrink: 1, color: colors.text, fontSize: 14, fontWeight: '600' }}>{w.name}</Text>
          <Text style={{ color: w.titles === most ? colors.accent : colors.muted, fontSize: 13, fontWeight: '700' }}>
            {`${w.titles} ${w.titles === 1 ? 'título' : 'títulos'}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function ChampionsScreen() {
  const { seasons, isLoading } = useSeasons();
  const [selectedId, setSelectedId] = useState('');
  const [view, setView] = useState<HallView>('campeao');
  const season = seasons.find((s) => s.bolao.id === selectedId) ?? seasons[0];
  const seasonId = season?.bolao.id ?? '';
  const summary = useQuery({ queryKey: ['rounds', seasonId], queryFn: () => getRoundsSummary(seasonId), enabled: !!seasonId });

  if (isLoading && seasons.length === 0) {
    return <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} />;
  }
  if (seasons.length === 0) {
    return (
      <View style={{ gap: 8, padding: 24, marginTop: 24 }}>
        <Text style={{ color: colors.muted, textAlign: 'center' }}>Nenhum bolão encerrado ainda.</Text>
        <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 13 }}>Os campeões aparecem aqui quando um bolão é finalizado.</Text>
      </View>
    );
  }

  const hasResults = !!season.champion && season.champion.total_points > 0;

  function openSeason(bolaoId: string) {
    setSelectedId(bolaoId);
    setView('campeao');
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
      <Segmented value={view} onChange={setView} />
      {view === 'temporadas' ? (
        <>
          <SeasonGallery seasons={seasons} onSelect={openSeason} />
          <BiggestWinners seasons={seasons} />
        </>
      ) : (
        <>
          {seasons.length > 1 && <SeasonChips seasons={seasons} selectedId={season.bolao.id} onSelect={setSelectedId} />}
          {!hasResults ? (
            <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 32 }}>Sem resultados registrados neste bolão.</Text>
          ) : (
            <>
              <ChampionHero season={season} rounds={summary.data?.rounds.length} />
              {season.tiedForFirst && (
                <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 12 }}>Empate na liderança — critérios de desempate esgotados.</Text>
              )}
              <RunnersUp runnerUp={season.runnerUp} third={season.third} />
              <FinalStandings ranking={season.ranking} />
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}
