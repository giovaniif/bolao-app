import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors } from '../theme';

export function TextField({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.muted, fontSize: 14 }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#64748b"
        style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 16 }}
        {...props}
      />
    </View>
  );
}
