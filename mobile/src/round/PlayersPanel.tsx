import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getMatches, type Match } from '../api/play';
import { getPlayerPredictions, type Member } from '../api/round';
import { colors } from '../theme';

function isClosed(m: Match, now: number) {
  return !!m.market_closes_at && new Date(m.market_closes_at).getTime() < now;
}

export function PlayersPanel({ bolaoId, round, players }: { bolaoId: string; round: number; players: Member[] }) {
  const [userId, setUserId] = useState('');
  const [now] = useState(() => Date.now());
  const matches = useQuery({ queryKey: ['matches', bolaoId, round], queryFn: () => getMatches(bolaoId, round), enabled: round > 0 });
  const list = matches.data ?? [];
  const closed = round > 0 && list.length > 0 && list.every((m) => isClosed(m, now));
  const selected = players.find((p) => p.id === userId);
  const predictions = useQuery({
    queryKey: ['predictions', bolaoId, round, 'user', userId],
    queryFn: () => getPlayerPredictions(bolaoId, round, userId),
    enabled: closed && !!selected,
  });
  const byMatch = Object.fromEntries((predictions.data ?? []).map((p) => [p.match_id, p]));
  const sorted = players.slice().sort((a, b) => a.display_name.localeCompare(b.display_name));

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: colors.muted, fontSize: 13 }}>Veja os palpites de qualquer jogador após o fechamento do mercado da rodada.</Text>
      {round > 0 && list.length > 0 && !closed && (
        <Text style={{ color: colors.accent, fontSize: 13 }}>O mercado desta rodada ainda não fechou. Os palpites dos jogadores só podem ser vistos após o fechamento.</Text>
      )}
      {round > 0 && !matches.isLoading && list.length === 0 && <Text style={{ color: colors.muted, fontSize: 13 }}>Nenhum jogo nesta rodada.</Text>}
      {closed && (
        <>
          <Text style={{ color: colors.muted, fontSize: 13 }}>Jogador</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {sorted.map((p) => {
              const active = p.id === userId;
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityLabel={p.display_name}
                  accessibilityState={{ selected: active }}
                  onPress={() => setUserId(p.id)}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: active ? colors.primary : colors.card, backgroundColor: active ? '#0b3b29' : colors.card }}
                >
                  <Text style={{ color: active ? colors.primary : colors.text, fontWeight: '700', fontSize: 13 }}>{p.display_name}</Text>
                </Pressable>
              );
            })}
          </View>
          {selected && (
            predictions.isLoading ? (
              <Text style={{ color: colors.muted }}>Carregando...</Text>
            ) : (
              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{`Palpites de ${selected.display_name}`}</Text>
                <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, overflow: 'hidden' }}>
                  {list.map((m, i) => {
                    const p = byMatch[m.id];
                    return (
                      <View key={m.id} style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Text style={{ color: colors.text }}>{m.home_team}</Text>
                          <Text style={{ color: colors.muted }}>{p ? `${p.home_goals} × ${p.away_goals}` : '–'}</Text>
                          <Text style={{ color: colors.text }}>{m.away_team}</Text>
                        </View>
                        {m.home_goals != null && m.away_goals != null && (
                          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{`Resultado: ${m.home_goals} × ${m.away_goals}`}</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
                {list.length > 0 && (predictions.data ?? []).length === 0 && (
                  <Text style={{ color: colors.muted, fontSize: 13 }}>Nenhum palpite registrado para esta rodada.</Text>
                )}
              </View>
            )
          )}
        </>
      )}
    </View>
  );
}
