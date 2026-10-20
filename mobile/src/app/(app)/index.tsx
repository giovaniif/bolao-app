import { Text, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { colors } from '../../theme';

export default function PredictTab() {
  const { user } = useAuth();
  return (
    <View style={{ flex: 1, padding: 24, gap: 8 }}>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>Olá, {user?.username}</Text>
      <Text style={{ color: colors.muted }}>Os palpites da rodada aparecem aqui.</Text>
    </View>
  );
}
