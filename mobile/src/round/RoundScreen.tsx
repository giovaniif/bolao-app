import { Text, View } from 'react-native';
import { colors } from '../theme';

export function RoundScreen() {
  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Text style={{ color: colors.muted, textAlign: 'center' }}>Parciais e palpites da galera chegam na próxima versão.</Text>
    </View>
  );
}
