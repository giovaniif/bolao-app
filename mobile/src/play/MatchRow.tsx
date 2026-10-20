import { Pressable, Text, View } from 'react-native';
import type { Match } from '../api/play';
import { colors } from '../theme';

function Stepper({ team, value, onChange }: { team: string; value: number; onChange: (v: number) => void }) {
  const button = { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.border, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Menos um gol de ${team}`} disabled={value === 0} onPress={() => onChange(value - 1)} style={[button, { opacity: value === 0 ? 0.4 : 1 }]}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>−</Text>
      </Pressable>
      <Text accessibilityLabel={`Gols de ${team}`} style={{ color: colors.text, fontSize: 24, fontWeight: '900', minWidth: 24, textAlign: 'center' }}>
        {value}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Mais um gol de ${team}`} onPress={() => onChange(value + 1)} style={button}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>+</Text>
      </Pressable>
    </View>
  );
}

export function MatchRow({
  match,
  home,
  away,
  closed,
  onChange,
}: {
  match: Match;
  home: number;
  away: number;
  closed: boolean;
  onChange: (home: number, away: number) => void;
}) {
  const hasResult = match.home_goals != null && match.away_goals != null;
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 14, gap: 10, opacity: closed ? 0.75 : 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>{match.home_team}</Text>
        {closed ? (
          <Text style={{ color: colors.text, fontWeight: '800', marginHorizontal: 8 }}>{home} x {away}</Text>
        ) : (
          <Stepper team={match.home_team} value={home} onChange={(v) => onChange(v, away)} />
        )}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>{match.away_team}</Text>
        {!closed && <Stepper team={match.away_team} value={away} onChange={(v) => onChange(home, v)} />}
      </View>
      {closed && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>Fechado</Text>
          {hasResult && (
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Resultado {match.home_goals} x {match.away_goals}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
