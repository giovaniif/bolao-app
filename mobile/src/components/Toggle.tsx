import { Pressable, Text, View } from 'react-native';
import { colors } from '../theme';

export function Toggle({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 12, padding: 14 }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{hint}</Text>
      </View>
      <View style={{ width: 46, height: 28, borderRadius: 14, padding: 3, backgroundColor: value ? colors.primary : colors.border, alignItems: value ? 'flex-end' : 'flex-start' }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.text }} />
      </View>
    </Pressable>
  );
}
