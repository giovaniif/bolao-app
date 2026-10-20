import { Text, View } from 'react-native';
import type { RuleBook } from '../api/boloes';
import { colors } from '../theme';

export function RulesList({ rules }: { rules: RuleBook }) {
  return (
    <View style={{ gap: 8 }}>
      {[...rules.match, ...rules.round].map((r) => (
        <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 10, padding: 12 }}>
          <Text style={{ color: colors.text, flex: 1 }}>{r.text}</Text>
          <Text style={{ color: colors.primary, fontWeight: '900' }}>{r.points}</Text>
        </View>
      ))}
      {rules.exact_score_variety_bonus.filter((t) => t.points > 0).map((t) => (
        <Text key={t.score_types} style={{ color: colors.muted, fontSize: 12 }}>
          {t.text}: <Text style={{ color: colors.accent, fontWeight: '800' }}>+{t.points}</Text>
        </Text>
      ))}
      {rules.notes.map((n) => (
        <Text key={n} style={{ color: colors.muted, fontSize: 12 }}>• {n}</Text>
      ))}
    </View>
  );
}
