import { ActivityIndicator, Pressable, Text } from 'react-native';
import { colors } from '../theme';

export function PrimaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const inactive = disabled || loading;
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: primary ? (pressed ? colors.primaryDark : colors.primary) : colors.card,
        borderColor: primary ? 'transparent' : colors.border,
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        opacity: inactive ? 0.5 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.onPrimary : colors.text} />
      ) : (
        <Text style={{ color: primary ? colors.onPrimary : colors.text, fontWeight: '800', fontSize: 16 }}>{title}</Text>
      )}
    </Pressable>
  );
}
