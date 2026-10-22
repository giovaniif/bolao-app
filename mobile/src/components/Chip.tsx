import { Pressable, Text } from 'react-native';
import { colors } from '../theme';

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? colors.primary : 'transparent',
        backgroundColor: active ? 'rgba(0,166,81,0.15)' : colors.card,
      }}
    >
      <Text style={{ color: active ? colors.primary : colors.muted, fontWeight: '800', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
